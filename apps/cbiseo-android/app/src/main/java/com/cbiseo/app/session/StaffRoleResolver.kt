package com.cbiseo.app.session

/** mirrors shared/cbiseoStaffAppPolicy.ts */
object StaffRoleResolver {
    fun homePathForRole(role: String?): String? =
        when (role) {
            "TEAM_LEADER", "EXTERNAL_PARTNER" -> "/team/dashboard"
            "ADMIN", "MARKETER", "OFFICE_STAFF" -> "/admin/dashboard"
            else -> null
        }

    fun usesAdminToken(role: String?): Boolean =
        role == "ADMIN" || role == "MARKETER" || role == "OFFICE_STAFF"

    fun usesTeamToken(role: String?): Boolean =
        role == "TEAM_LEADER" ||
            role == "EXTERNAL_PARTNER" ||
            usesAdminToken(role)

    /** 해피콜 FCM — 팀장·타업체 담당만 */
    fun canReceiveHappyCallPush(role: String?): Boolean =
        role == "TEAM_LEADER" || role == "EXTERNAL_PARTNER"
}
