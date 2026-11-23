/**
 * @param {import('@strapi/types').Core.Config.Shared.ConfigParams} config
 */
module.exports = ({ env }) => ({
	'user-permissions': {
		config: {
			jwt: {
				secret: env('JWT_SECRET'),
			},
		},
	},
});
