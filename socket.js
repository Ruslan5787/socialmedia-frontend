import {io} from "socket.io-client";

export const socket = io("http://localhost:27018", {
    transports: ['websocket'],
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        allowedHeaders: ['Access-Control-Allow-Origin'],
    },
    autoConnect: true,
})