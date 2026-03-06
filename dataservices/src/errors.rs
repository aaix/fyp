use scylla::errors::{DeserializationError, ExecutionError, FirstRowError, IntoRowsResultError, NextRowError, PagerExecutionError, RowsError, SingleRowError, TypeCheckError};
use tonic::Status;

pub struct DSStatus(Status);

pub type DSResult<V> = Result<V, DSStatus>;

impl Into<String> for DSStatus {
    fn into(self) -> String {
        format!("{}: {}", self.0.code(), self.0.message())
    }
}


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

impl From<SingleRowError> for DSStatus {
    fn from(value: SingleRowError) -> Self {
        eprintln!("SingleRowError: {:?}", value);
        return match value {
            _ => Status::internal("deserialise single row fail")
        }.into()
    }
}

impl From<PagerExecutionError> for DSStatus {
    fn from(value: PagerExecutionError) -> Self {
        eprintln!("PagerExecutionError: {:?}", value);
        return match value {
            _ => Status::internal("paging execution fail")
        }.into()
    }
}

impl From<RowsError> for DSStatus {
    fn from(value: RowsError) -> Self {
        eprintln!("RowsError: {:?}", value);
        return match value {
            _ => Status::internal("rows deserialisation fail")
        }.into()
    }
}

impl From<DeserializationError> for DSStatus {
    fn from(value: DeserializationError) -> Self {
        eprintln!("DeserializationError: {:?}", value);
        Status::internal("value deserialise fail").into()
    }
}

impl From<TypeCheckError> for DSStatus {
    fn from(value: TypeCheckError) -> Self {
        eprintln!("Typecheck error: {:?}", value);
        Status::internal("value type check error").into()
    }
}

impl From<NextRowError> for DSStatus {
    fn from(value: NextRowError) -> Self {
        eprint!("next row error {:?}", value);
        match value {
            NextRowError::RowDeserializationError(deserialization_error) => deserialization_error.into(),
            _ => Status::internal("failed to paginate rows").into(),
        }
    }
}