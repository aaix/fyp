FROM scylladb/scylla:latest
COPY ./database.cql /schema.cql
CMD ["--reactor-backend=epoll", "--seeds=scylla-seed", "--smp=1", "--memory=1536M"]