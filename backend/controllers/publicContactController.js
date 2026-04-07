const { addPublicContact } = require('../services/publicContactService');

exports.addPublicContact = async (req, res) => {
  const { userId, contactInfo, cardIndex } = req.body || {};

  console.log('Add Contact called - Public endpoint');
  console.log('Raw request body:', JSON.stringify(req.body, null, 2));

  try {
    const result = await addPublicContact({ userId, contactInfo, cardIndex });
    return res.status(201).send(result);
  } catch (error) {
    console.error('Error adding contact:', error);

    if (error.status) {
      return res.status(error.status).send({
        success: false,
        message: error.message,
        ...(error.code ? { error: error.code } : {}),
        ...(error.details || {}),
      });
    }

    return res.status(500).send({
      success: false,
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};
