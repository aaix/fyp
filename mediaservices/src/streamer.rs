use std::io::{ErrorKind, Read, Write};


use tokio::sync::mpsc::{self, Receiver, Sender};

use crate::{errors::{MSError, MSResult}, protos::mediaservices::transformer::{MediaInput, media_input::{self,}}};
pub struct AsyncStreamer<T> {
    streaming: tonic::Streaming<T>,
    sender: Sender<T>,
}

pub struct SyncStreamer<T> {
    recv: Receiver<T>,
    last_message: Option<T>,
    partial_written: Option<usize>
}

impl AsyncStreamer<MediaInput> {
    pub fn new(streaming: tonic::Streaming<MediaInput>) -> (Self, SyncStreamer<MediaInput>) {

        let (sender, receiver) = mpsc::channel::<MediaInput>(1);

        (Self {
            streaming,
            sender,
        }, SyncStreamer::new(
            receiver
        ))
    }

    pub async fn recv(mut self) -> MSResult<()> {
        while let Some(m) = self.streaming.message().await.map_err(|e| {
            tracing::error!("{e:?}");
            MSError::Cancelled
        })? {
            if let Err(e) = self.sender.send(m).await {
                tracing::error!("{e:?}");
                return Err(MSError::Unknown("Syncstreamer closed channel"));
            }
        }
        Ok(())
    }

    pub async fn get_one(&mut self) -> Result<Option<MediaInput>, tonic::Status> {
        self.streaming.message().await
    }

}

impl SyncStreamer<MediaInput> {
    fn new(recv: Receiver<MediaInput>) -> Self {
        Self {
            recv,
            last_message: None,
            partial_written: None,
        }
    }

    fn populate_buf(&mut self) -> Option<()> {
        let d = self.recv.blocking_recv()?;
        self.last_message = Some(d);
        Some(())
    }
}

impl Read for SyncStreamer<MediaInput> {
    fn read(&mut self, mut buf: &mut [u8]) -> std::io::Result<usize> {

        let msg_opt = self.last_message.as_ref();

        // populate self.last_message if needed
        if msg_opt.is_none() && self.populate_buf().is_none() {
            return Ok(0)
        }

        let msg = self.last_message.as_ref().unwrap();
        if msg.next.is_none() {
            return Ok(0)
        }
        let next = msg.next.as_ref().unwrap();
        let d = match next {
            media_input::Next::Asset(_) => return Err(
                std::io::Error::new(ErrorKind::InvalidData, "Unexpected asset in stream")
            ),
            media_input::Next::Chunk(items) => items,
        };


        let max = buf.len();
        let start = self.partial_written.unwrap_or_default();
        let msg_len = d.len() - start;

        let mut consumed_buf = false;
        let to_write = if max < msg_len {
            self.partial_written = Some(start + max);
            max
        } else {
            // we wrote the whole thing, so we must empty the current buf
            consumed_buf = true;
            msg_len
        };
        buf.write(&d[start..start+to_write])?;

        if consumed_buf {
            self.partial_written = None;
            self.last_message = None;
        }

        Ok(to_write)

    }
}