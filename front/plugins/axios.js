import Vue from 'vue'
import axios from 'axios'

let service = axios.create({
  baseURL: '/api'
})

Vue.prototype.$http = service
export const http = service