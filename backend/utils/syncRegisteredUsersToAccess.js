const User = require('../models/User');
const AuthorizedEmail = require('../models/AuthorizedEmail');

/** Add existing accounts to the registration access list without overwriting
 * any access settings an admin has already configured for that email. */
async function syncRegisteredUsersToAccess() {
  const users = await User.find()
    .select('name email department semester isActive')
    .lean();
  if (!users.length) return 0;

  const result = await AuthorizedEmail.bulkWrite(users.map(user => ({
    updateOne: {
      filter: { email: String(user.email || '').trim().toLowerCase() },
      update: {
        $setOnInsert: {
          email: String(user.email || '').trim().toLowerCase(),
          name: user.name || '',
          branch: user.department || '',
          semester: user.semester || null,
          isEnabled: user.isActive !== false,
          isDeleted: false,
          source: 'registered',
        },
      },
      upsert: true,
    },
  })), { ordered: false });

  return result.upsertedCount || 0;
}

module.exports = syncRegisteredUsersToAccess;
