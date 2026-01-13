const cloudinary = require("cloudinary").v2;

cloudinary.config({
    cloud_name: process.env.Cloudinary_Cloud_Name,
    api_key: process.env.Cloudinary_Api_Key,
    api_secret: process.env.Cloudinary_Secret_Api
});

module.exports = cloudinary;