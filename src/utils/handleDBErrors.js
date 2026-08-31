function handleValidationErrors(errors) {
  const resErrors = {};

  for (const [key, value] of Object.entries(errors)) {
    resErrors[key] = value.message;
  }

  return resErrors;
}

export function handleDBErrors(err, res) {
  console.log("DB Err Code: ", err.name);

  if (err.name === "ValidationError") {
    const errors = handleValidationErrors(err.errors);

    return res.status(400).json({
      success: false,
      message: "Failed to update",
      customErr: errors,
    });
  }
}
