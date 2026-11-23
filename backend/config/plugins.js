/**
 * @param {import('@strapi/types').Core.Config.Shared.ConfigParams} config
 */
module.exports = ({ env }) => ({
	usersPermissions: {
		config: {
			jwt: {
				secret: env('JWT_SECRET'),
			},
		},
	},
});
