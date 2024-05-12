

cd app
docker build -t my-app .
docker tag my-app:latest 123456789012.dkr.ecr.region.amazonaws.com/my-app:latest
docker push 123456789012.dkr.ecr.region.amazonaws.com/my-app:latest 