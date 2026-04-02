fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut config = tonic_prost_build::Config::new();
    config.protoc_arg("--experimental_allow_proto3_optional");
    let protos = ["proto/plib.proto", "proto/user.proto", "proto/channel.proto", "proto/message.proto", "proto/post.proto", "proto/feed.proto"];
    tonic_prost_build::configure().compile_with_config(config, &protos, &["proto"])?;
    Ok(())
}