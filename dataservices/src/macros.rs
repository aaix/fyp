
/// Extract a timeuuid from request object
/// Works with uuid
#[macro_export]
macro_rules! req_tuuid {
    ($req:expr, $field:ident) => {
        $req.get_ref()
            .$field
            .map(|parts| parts.into())
            .ok_or(tonic::Status::invalid_argument(concat!("invalid ", stringify!($field))))
    };
}

#[macro_export]
macro_rules! req_ref {
    ($req:expr, $field:ident) => {
        $req.get_ref()
            .$field
            .as_ref()
            .ok_or(tonic::Status::invalid_argument(concat!("invalid ", stringify!($field))))

    }
}


#[macro_export]
macro_rules! maybe_opt_field {
    ($payload:expr, $field:ident, $mask:expr) => {
        if $mask.paths.iter().any(|v| v == stringify!($field)) {
            MaybeUnset::Set($payload.$field)
        } else {
            MaybeUnset::Unset
        }
    }
}

#[macro_export]
macro_rules! maybe_opt_field_into {
    ($payload:expr, $field:ident, $mask:expr) => {
        if $mask.paths.iter().any(|v| v == stringify!($field)) {
            MaybeUnset::Set($payload.$field.map(Into::into))
        } else {
            MaybeUnset::Unset
        }
    }
}

#[macro_export]
macro_rules! profile_statement {
    ($name:expr, $stmt:expr) => {{
        use tracing::Instrument;
        let span = tracing::info_span!(
            $name,
            status = "pending"
        );
        $stmt.instrument(span)
    }}
}
