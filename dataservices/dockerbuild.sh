TAG=${1:-latest}
python ./dataservices/model_generator.py
docker build ./dataservices -t az-dataservices:$TAG