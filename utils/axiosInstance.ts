import axios from "axios";

const DEVELOPMENT_URL = "http://192.168.1.62:5000/api/v1";
const PRODUCTION_URL = "https://kalangka-backend.onrender.com/api/v1";

const client = axios.create({
  baseURL: __DEV__ ? DEVELOPMENT_URL : PRODUCTION_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

export default client;
