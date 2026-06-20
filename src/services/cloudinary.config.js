// cloudinary-config.js - Cấu hình Cloudinary để tải ảnh
// Học viên cần lấy thông tin từ Dashboard của Cloudinary (https://cloudinary.com/)

const CLOUD_NAME = "deojm43co"; // Thay bằng Cloud Name của bạn
const UPLOAD_PRESET = "Highlands Coffee Project Structure"; // Thay bằng Upload Preset (chế độ Unsigned)

export const CLOUDINARY_API = {
    uploadUrl: `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    uploadPreset: UPLOAD_PRESET
};