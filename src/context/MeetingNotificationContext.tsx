import React, { createContext, useContext, useState, ReactNode, useMemo } from 'react';

export interface MeetingNotificationSummary {
  id: string;
  title: string;
  meetingWhen?: string;
  meetingWith?: string;
  location?: string;
  formattedTime?: string;
}

interface MeetingNotificationContextValue {
  startingSoon: MeetingNotificationSummary[];
  recentBookings: MeetingNotificationSummary[];
  updateNotifications: (data: {
    startingSoon: MeetingNotificationSummary[];
    recentBookings: MeetingNotificationSummary[];
  }) => void;
}

const MeetingNotificationContext = createContext<MeetingNotificationContextValue | undefined>(undefined);

export const MeetingNotificationProvider = ({ children }: { children: ReactNode }) => {
  const [startingSoon, setStartingSoon] = useState<MeetingNotificationSummary[]>([]);
  const [recentBookings, setRecentBookings] = useState<MeetingNotificationSummary[]>([]);

  const updateNotifications: MeetingNotificationContextValue['updateNotifications'] = ({ startingSoon, recentBookings }) => {
    setStartingSoon(startingSoon);
    setRecentBookings(recentBookings);
  };

  const value = useMemo(
    () => ({
      startingSoon,
      recentBookings,
      updateNotifications,
    }),
    [startingSoon, recentBookings]
  );

  return (
    <MeetingNotificationContext.Provider value={value}>
      {children}
    </MeetingNotificationContext.Provider>
  );
};

export const useMeetingNotifications = (): MeetingNotificationContextValue => {
  const context = useContext(MeetingNotificationContext);
  if (!context) {
    throw new Error('useMeetingNotifications must be used within a MeetingNotificationProvider');
  }
  return context;
};

