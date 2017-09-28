const awsSDK = require('aws-sdk')
const dynamoDoc = new awsSDK.DynamoDB.DocumentClient()
const sendEmail = require('./sendEmail')
const ENTRIES_TABLE = process.env.ENTRIES_TABLE
const FORMS_TABLE = process.env.FORMS_TABLE
const corsHeaders = {
  // Required for CORS support to work
  'Access-Control-Allow-Origin': '*',
  // Required for cookies, authorization headers with HTTPS
  'Access-Control-Allow-Credentials': true
}
/*
  Update forms table and form entries table on form submission
*/
module.exports.handleFormSubmission = (event, context, callback) => {
  const body = JSON.parse(event.body)
  const formId = body.formId
  const fields = body.fields
  const timestamp = Math.round(+new Date() / 1000)

  if (body.action === 'ping') {
    return callback(null, {
      statusCode: 200,
      body: JSON.stringify({
        pong: true,
      })
    })
  }

  if (!formId) {
    return callback(new Error('[400] No formId passed into function'))
  }

  if (!fields) {
    return callback(new Error('[400] No fields passed into function'))
  }

  const params = {
    TableName: FORMS_TABLE,
    Key: {
      formId: formId
    },
    // Update or create items
    UpdateExpression: 'SET #updated = :updated, #created = if_not_exists(#created, :created) ADD #submissionCount :incr',
    ExpressionAttributeNames: {
      '#updated': 'updated',
      '#created': 'created',
      '#submissionCount': 'submissionCount'
    },
    ExpressionAttributeValues: {
      ':incr': 1,
      ':created': timestamp,
      ':updated': timestamp,
    },
    ReturnValues: 'ALL_NEW'
  };

  dynamoDoc.update(params).promise().then((data) => {
    if (!data || !data.Attributes) {
      return callback(new Error('[500] Database error. No form Data'))
    }
    const formInfo = data.Attributes
    console.log('Form Submission count', formInfo.submissionCount)

    // Now Save data to form entries table
    const formEntry = Object.assign({}, {
      formId: formId,
      timestamp: timestamp,
    }, fields)

    const entryParams = {
      TableName: ENTRIES_TABLE,
      Item: formEntry
    }

    return dynamoDoc.put(entryParams).promise().then((d) => {
      // then send email
      if (formInfo && formInfo.notify) {
        const emails = formInfo.notify
        if (emails) {
          // TODO: split emails at comma
          sendEmail(emails, formEntry, (err, response) => {
            if (err) {
              return callback(err)
            }
            return callback(null, {
              statusCode: 200,
              headers: corsHeaders,
              body: JSON.stringify({
                success: true,
                data: d
              })
            })
          })
        }
      }
      // return and send no emails
      return callback(null, {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: d
        })
      })
    })
  }).catch((e) => {
    console.log(e)
    return callback(new Error('[500] Database error', e))
  })
}

/*
  Update forms table and form entries table on form submission
*/
module.exports.getFormSubmissions = (event, context, callback) => {
  console.log(event)
  const body = JSON.parse(event.body)
  const formId = body.formId
  const to = body.to || Math.round(+new Date() / 1000)

  const unixDay = 86400000
  let from = body.from || 'alltime'
  if (from === 'alltime') {
    from = 0
  } else if (from === 'yesterday') {
    from = Math.round(new Date(Date.now() - unixDay).getTime() / 1000)
  } else if (from === 'lastweek') {
    from = Math.round(new Date(Date.now() - (unixDay * 7)).getTime() / 1000)
  }

  let params = {
    TableName: ENTRIES_TABLE,
    KeyConditionExpression: "#formId = :formId and #timestamp BETWEEN :from AND :to",
    ExpressionAttributeNames: {
      "#formId": "formId",
      "#timestamp": "timestamp"
    },
    ExpressionAttributeValues: {
      ":formId": formId,
      ":from": from,
      ":to": to
    }
  }

  const getFormResults = (formEntries, offset) => {
    const entries = formEntries || []
    if (offset) {
      // update query with offset
      params.ExclusiveStartKey = offset;
    }
    return dynamoDoc.query(params).promise().then((result) => {
      const allFormEntries = entries.concat(result.Items);
      if (!result.LastEvaluatedKey) {
        return allFormEntries
      }
      console.log('Recusive call to next page of data')
      return getFormResults(allFormEntries, result.LastEvaluatedKey);
    })
  }

  getFormResults().then((items) => {
    return callback(null, {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(items)
    })
  }).catch((e) => {
    console.log(e)
    return callback(new Error('[500] Database error', e))
  })
}

module.exports.updateFormSettings = (event, context, callback) => {
  const body = JSON.parse(event.body)
  const formId = body.formId
  const emails = body.emails

  if (!formId) {
    return callback(new Error('[400] No formId passed into function'))
  }

  if (!emails) {
    return callback(new Error('[400] No emails passed into function'))
  }

  const params = {
    TableName: FORMS_TABLE,
    Key: {
      formId: formId
    },
    // Update or create items
    UpdateExpression: 'SET #notify = :notify',
    ExpressionAttributeNames: {
      '#notify': 'notify',
    },
    ExpressionAttributeValues: {
      ':notify': emails,
    },
    ReturnValues: 'UPDATED_NEW'
  };

  dynamoDoc.update(params).promise().then((data) => {
    return callback(null, {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        data: data
      })
    })
  }).catch((e) => {
    console.log(e)
    return callback(new Error('[500] Database error', e))
  })
}

/*
  Get form list
*/
module.exports.getForms = (event, context, callback) => {

  let params = {
    TableName: FORMS_TABLE
  }

  const getAllForms = (forms, offset) => {
    const formList = forms || []
    if (offset) {
      // update scan with offset
      params.ExclusiveStartKey = offset;
    }
    return dynamoDoc.scan(params).promise().then((result) => {
      const allForms = formList.concat(result.Items);
      if (!result.LastEvaluatedKey) {
        return allForms
      }
      console.log('Recusive call to next page of forms')
      return getAllForms(allForms, result.LastEvaluatedKey);
    })
  }

  getAllForms().then((forms) => {
    return callback(null, {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(forms)
    })
  }).catch((e) => {
    console.log(e)
    return callback(new Error('[500] Database error', e))
  })
}
