import axios from "axios";

const DEVELOPMENT_URL = "http://192.168.1.62/api/";
const PRODUCTION_URL =
  "https://frozen-wave-03515-0a5c6e1cc459.herokuapp.com/api/";

const client = axios.create({
  baseURL: __DEV__ ? DEVELOPMENT_URL : PRODUCTION_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

export default client;
