const logger = (req, res, next) => {
  // Log request
  console.log(`[Request] ${req.method} ${req.url}`, {
    headers: req.headers,
    body: req.body,
    query: req.query,
    params: req.params
  });

  // Store the original res.json function
  const originalJson = res.json;

  // Override the res.json function
  res.json = function (body) {
    // Log response
    console.log(`[Response] ${req.method} ${req.url}`, {
      status: res.statusCode,
      body: body
    });

    // Call the original res.json function
    return originalJson.call(this, body);
  };

  // Store the original res.send function
  const originalSend = res.send;

  // Override the res.send function
  res.send = function (body) {
    // Log response
    console.log(`[Response] ${req.method} ${req.url}`, {
      status: res.statusCode,
      body: body
    });

    // Call the original res.send function
    return originalSend.call(this, body);
  };

  next();
};

module.exports = logger; 