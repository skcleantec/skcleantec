import { useEffect, useState } from 'react';
import { getToken } from '../stores/auth';
import { getMe } from '../api/auth';
import { getAllProfessionalOptions, type ProfessionalSpecialtyOptionDto } from '../api/orderform';
import { getAssignableScheduleUsers, getInquiryCreatorOptions } from '../api/users';
import { listServiceZones, type ServiceZoneItem } from '../api/serviceZones';
import { getUserCustomCalendars, type UserCustomCalendarItem } from '../api/userCustomCalendars';
import type { UserItem } from '../api/users';
import {
  hasStaffPermission,
  resolveMarketerOperationalAdminFromMe,
  type StaffAdminMeFields,
} from '../utils/staffAdminAccess';

export type CrmInquiryEditMe = {
  id: string;
  role: string;
  name: string;
  email?: string;
};

export function useCrmInquiryEditSupport(enabled: boolean) {
  const [loading, setLoading] = useState(enabled);
  const [teamLeaders, setTeamLeaders] = useState<UserItem[]>([]);
  const [profCatalog, setProfCatalog] = useState<ProfessionalSpecialtyOptionDto[]>([]);
  const [marketers, setMarketers] = useState<UserItem[]>([]);
  const [serviceZones, setServiceZones] = useState<ServiceZoneItem[]>([]);
  const [customCalendars, setCustomCalendars] = useState<UserCustomCalendarItem[]>([]);
  const [me, setMe] = useState<CrmInquiryEditMe | null>(null);
  const [staffMe, setStaffMe] = useState<StaffAdminMeFields | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void Promise.all([
      getAssignableScheduleUsers(token).then((r) => r.items),
      getAllProfessionalOptions(token),
      getInquiryCreatorOptions(token),
      listServiceZones(token),
      getUserCustomCalendars(token),
      getMe(token),
    ])
      .then(([leaders, catalog, creatorOptions, zones, calendars, rawMe]) => {
        if (cancelled) return;
        setTeamLeaders(leaders);
        setProfCatalog(catalog);
        setMarketers(creatorOptions);
        setServiceZones(zones);
        setCustomCalendars(calendars);
        const staff: StaffAdminMeFields = {
          role: rawMe.role,
          effectiveStaffAdminAccess: rawMe.effectiveStaffAdminAccess,
          marketerAdminLevel: rawMe.marketerAdminLevel,
          marketerPermissions: rawMe.marketerPermissions ?? null,
          marketerOperationalAdminAccess: rawMe.marketerOperationalAdminAccess,
        };
        setStaffMe(staff);
        setMe({
          id: rawMe.id,
          role: rawMe.role,
          name: rawMe.name,
          email: typeof rawMe.email === 'string' ? rawMe.email : undefined,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setTeamLeaders([]);
        setProfCatalog([]);
        setMarketers([]);
        setServiceZones([]);
        setCustomCalendars([]);
        setMe(null);
        setStaffMe(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const operationalAdmin = resolveMarketerOperationalAdminFromMe(staffMe);
  const canEditMarketerField = hasStaffPermission(staffMe, 'inquiry.edit.marketer');
  const canDeleteInquiry = hasStaffPermission(staffMe, 'inquiry.delete');

  return {
    loading,
    teamLeaders,
    profCatalog,
    marketers,
    serviceZones,
    customCalendars,
    setCustomCalendars,
    me,
    operationalAdmin,
    canEditMarketerField,
    canDeleteInquiry,
  };
}
