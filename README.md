# A private social media with encrypted messaging

## Infrastructure

![Architecture diagram](/z_docs/architecture2.drawio.png)

### Frontend (client)
The frontend is a vite+react static webapp currently deployed on cloudflare pages

### Database
A standard scyllaDB cluster - a noSQL database for the dataservices

### Elasticsearch
An elasticsearch cluster for powerful searching of things in the database (users etc)

### Object storage
Cloudflare R2 is used (aws s3 compatible) for storing public & private assets (posts, images)
a public bucket is for public user content (user profile pictures)
a private bucket is for private user content (user posts) - the api will give out authenticated urls

## Microservices

### API
A stateless python service that handles the majority of business logic over a REST api

### Gateway
Stateful python service that handles pushing updates to clients

### Dataservices
Rust service for abstracting interaction with the database, provides gRPC to other services to perform database queries

Can provide either caching or request coalescing to avoid hot index stress on the scylla cluster

### Invalidation server
Authoratative source for invalidating user sessions (e.g. logging out or revoking devices)

### Garbage collector
A small microservice for detecting data leaks from failed nested transactions (e.g. orphaned assets on r2)

### Media services
A microservice for transforming public media and uploading to r2