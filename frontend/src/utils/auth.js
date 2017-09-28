import { EventEmitter } from 'events'
import lockInstance from './authLockInstance'
import decode from 'jwt-decode'
import history from './history'

export default class Auth extends EventEmitter {

  lock = lockInstance()

  userProfile

  constructor() {
    super()
    // Add callback Lock's `authenticated` event
    this.lock.on('authenticated', this.setSession.bind(this))
    // Add callback for Lock's `authorization_error` event
    this.lock.on('authorization_error', error => console.log(error))
    // binds functions to keep this context
    this.login = this.login.bind(this)
    this.logout = this.logout.bind(this)
    this.getProfile = this.getProfile.bind(this)
    this.isAdmin = this.isAdmin.bind(this)
    this.authFetch = this.authFetch.bind(this)
  }

  login() {
    // Call the show method to display the widget.
    this.lock.show({
      initialScreen: 'login',
      auth: {
       params: {
         state: 'hellostate', // xsrf
         scope: 'openid offline_access',
         other: 'what'
       },
     },
    })
  }

  setSession(authResult) {
    console.log('authResult', authResult)
    console.log(authResult.state)
    const result = authResult
    // debugger
    if (authResult && authResult.accessToken && authResult.idToken) {
      // Set the time that the access token will expire at
      let expiresAt = JSON.stringify(
        authResult.expiresIn * 1000 + new Date().getTime()
      )
      localStorage.setItem('access_token', authResult.accessToken)
      localStorage.setItem('id_token', authResult.idToken)
      localStorage.setItem('expires_at', expiresAt)
      // navigate to the forms route
      history.replace('/forms')
    }
  }

  getAccessToken() {
    const accessToken = localStorage.getItem('access_token')
    if (!accessToken) {
      throw new Error('No access token found')
    }
    return accessToken
  }

  getProfile(cb) {
    let accessToken = this.getAccessToken()
    this.lock.getUserInfo(accessToken, (err, profile) => {
      if (profile) {
        this.userProfile = profile
      }
      cb(err, profile)
    })
  }

  logout() {
    // Clear access token and ID token from local storage
    localStorage.removeItem('access_token')
    localStorage.removeItem('id_token')
    localStorage.removeItem('expires_at')
    this.userProfile = null
    // navigate to the home route
    history.replace('/')
  }

  isAuthenticated() {
    // Check whether the current time is past the
    // access token's expiry time
    let expiresAt = JSON.parse(localStorage.getItem('expires_at'))
    console.log('isAuthenticated', expiresAt)
    return new Date().getTime() < expiresAt
  }

  getRole() {
    const namespace = 'https://example.com'
    const idToken = localStorage.getItem('id_token')
    if (!idToken) {
      return null
    }
    console.log('yes')
    console.log('decode(idToken)', decode(idToken))
    return decode(idToken)[`${namespace}/role`] || null
  }

  isAdmin() {
    console.log('is admin')
    return this.getRole() === 'admin'
  }

  authFetch(url, options) {
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    }

    if (this.isAuthenticated()) {
      headers['Authorization'] = 'Bearer ' + this.getAccessToken()
    }

    return fetch(url, { headers, ...options })
      .then(this.checkStatus)
      .then(response => response.json())
  }

  checkStatus(response) {
    if (response.status >= 200 && response.status < 300) {
      return response
    } else {
      let error = new Error(response.statusText)
      error.response = response
      throw error
    }
  }
}
