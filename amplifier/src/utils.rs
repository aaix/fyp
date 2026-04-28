use init_tracing_opentelemetry::tracing_opentelemetry::{OpenTelemetrySpanExt};
use opentelemetry::trace::{TraceContextExt};
use tracing::Span;

use crate::protos::traceparent::TraceParent;



pub fn get_current_traceparent() -> Option<TraceParent> {
    let context = Span::current().context();

    let span = context.span();
    let context = span.span_context();
    if !context.is_valid() {
        return None;
    }

    let trace_id = u128::from_be_bytes(context.trace_id().to_bytes());
    
    let trace_id_hi = (trace_id >> 64) as u64;
    let trace_id_lo = trace_id as u64;

    let parent_id = u64::from_be_bytes(context.span_id().to_bytes());

    Some(TraceParent {
        trace_id_lo,
        trace_id_hi,
        parent_id,
        flags: context.trace_flags().to_u8() as u32,
    })
}