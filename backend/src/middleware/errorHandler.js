const errorHandler = (err, req, res, next) => {
  const statusCode =
    err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);

  res.status(statusCode).json({
    success: false,
    message: err.message || "Server Error",
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
};

export default errorHandler;
