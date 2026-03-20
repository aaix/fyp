fn main() -> Result<(), Box<dyn std::error::Error>> {
    let config = tonic_prost_build::Config::new();

    let protos = ["proto/media.proto", "proto/asset.proto"];
    tonic_prost_build::configure().compile_with_config(config, &protos, &["proto"])?;
    Ok(())
}