FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o engine .cmd/engine

FROM alpine:3.20
WORKDIR /app
COPY --from=builder /app/engine .
CMD ["./engine"]