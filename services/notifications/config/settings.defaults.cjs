module.exports = {
  internal: {
    notifications: {
      port: parseInt(process.env.PORT || '3042', 10),
      host: process.env.LISTEN_ADDRESS || '127.0.0.1',
    },
  },

  mongo: {
    url:
      process.env.MONGO_CONNECTION_STRING ||
      `mongodb://${process.env.MONGO_HOST || '127.0.0.1'}/sharelatex`,
    options: {
      monitorCommands: true,
    },
  },
}
