### Setup a local relayer to test it with Docker

docker run -p 8080:8080 scsibug/nostr-rs-relay

### Set up a basic Nostr relay using an existing TypeScript implementation

## use NOSTR RELAY NESTJS

- https://github.com/CodyTseng/nostr-relay-nestjs

## Deploy NOSTR RELAY

# Build Image

- ./scripts/build.sh

# Run Containers

- ./scripts/run.sh

# set up environment variable

- DATABASE_URL

# Execute migration scripts

- npm run migration:run
