
/// Extract a timeuuid from request object
/// Works with uuid
#[macro_export]
macro_rules! req_tuuid {
    ($req:expr, $field:ident) => {
        $req.get_ref()
            .$field
            .map(|parts| parts.into())
            .ok_or(Status::invalid_argument(concat!("invalid ", stringify!($field))))
    };
}
