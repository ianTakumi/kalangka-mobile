import axios from "axios";

const client = axios.create({
  baseURL: "http://192.168.1.62:5000/api/v1",
  timeout: 10000, // 10 seconds timeout
  headers: {
    "Content-Type": "application/json",
  },
});

export default client;
