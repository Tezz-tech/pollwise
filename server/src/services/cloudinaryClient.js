/**
 * Thin adapter over the cloudinary SDK (SECURITY §7). Tests pass a fake with the same three methods, so
 * upload rules can be tested without the network.
 *
 * Returns null when the environment has no Cloudinary credentials; upload endpoints then answer 503.
 */
import { v2 as cloudinary } from 'cloudinary';

/**
 * @param {{ CLOUDINARY_CLOUD_NAME?: string, CLOUDINARY_API_KEY?: string, CLOUDINARY_API_SECRET?: string }} config
 */
export function createCloudinaryClient(config) {
  const {
    CLOUDINARY_CLOUD_NAME: cloudName,
    CLOUDINARY_API_KEY: apiKey,
    CLOUDINARY_API_SECRET: apiSecret,
  } = config;
  if (!cloudName || !apiKey || !apiSecret) return null;

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
  return {
    cloudName,
    apiKey,
    /** Sign the parameters of a direct upload. The secret never leaves the server. */
    sign(params) {
      return cloudinary.utils.api_sign_request(params, apiSecret);
    },
    /** Fetch the asset's real metadata (format, size, pages) for verification. */
    async resource(publicId, resourceType) {
      return cloudinary.api.resource(publicId, { resource_type: resourceType });
    },
    /** Remove an asset that failed verification. */
    async destroy(publicId, resourceType) {
      return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    },
  };
}
