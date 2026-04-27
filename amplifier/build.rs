fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut config = tonic_prost_build::Config::new();
    config.protoc_arg("--experimental_allow_proto3_optional");
    let protos = ["proto/amplify.proto"];
    tonic_prost_build::configure().compile_with_config(config, &protos, &["proto", "../shared/sharedproto/"])?;
    Ok(())
}