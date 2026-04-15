// Middleware to Check Authentication

const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        return next();
    }
    res.status(401).json({ message: 'Unauthorised: Please Log In' });
};

module.exports = isAuthenticated;