use scylla::errors::{ExecutionError, FirstRowError, IntoRowsResultError};
use tonic::Status;

pub struct DSStatus(Status);

pub type DSResult<V> = Result<V, DSStatus>;

impl From<DSStatus> for Status {
    fn from(value: DSStatus) -> Self {
        return value.0;
    }
}

impl From<Status> for DSStatus {
    fn from(value: Status) -> Self {
        return Self(value)
    }
}


impl From<FirstRowError> for DSStatus {
    fn from(value: FirstRowError) -> Self {
        eprintln!("FirstRowError: {:?}", value);
        return match value {
            FirstRowError::RowsEmpty => Status::not_found("no row found"),
            _ => Status::internal("deserialise data fail")
        }.into()
    }
}

impl From<IntoRowsResultError> for DSStatus {
    fn from(value: IntoRowsResultError) -> Self {
        eprint!("IntoRowsResultError: {:?}", value);
        return Status::internal("deserialise rows failure").into()
    }
}

impl From<ExecutionError> for DSStatus {
    fn from(value: ExecutionError) -> Self {
        eprint!("ExecutionError: {:?}", value);
        use ExecutionError::*;
        match value {
            BadQuery(_) | EmptyPlan | PrepareError(_) => Status::internal("statement exec fail"),
            _ => Status::unavailable("statement exec failed")
        }.into()
    }
}