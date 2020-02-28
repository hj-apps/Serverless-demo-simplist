
module.exports.config = {
  // auth0 setup
  auth0: {
    domain: 'dev-wy2v41z0.auth0.com',
    clientId: '7auel4PUG5q9PKRht06I2KqOxbh1b3pC',
    callbackPath: '/callback',
  },
  // api endpoints
  api: {
    forms: 'https://d3ul21vxig.execute-api.us-west-2.amazonaws.com/prod/get-forms',
    submissions: 'https://d3ul21vxig.execute-api.us-west-2.amazonaws.com/prod/get-entries',
    deleteEntry: 'https://d3ul21vxig.execute-api.us-west-2.amazonaws.com/prod/delete-entry',
    updateFormSettings: 'https://d3ul21vxig.execute-api.us-west-2.amazonaws.com/prod/update-form-settings'
  }
}
