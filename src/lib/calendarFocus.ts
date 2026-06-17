const CALENDAR_FOCUS_EVENT_KEY = 'axe_calendar_focus_event';

export function setCalendarFocusEventId(id: string) {
  try {
    sessionStorage.setItem(CALENDAR_FOCUS_EVENT_KEY, id);
  } catch {
    /* ignore */
  }
}

export function consumeCalendarFocusEventId(): string | null {
  try {
    const id = sessionStorage.getItem(CALENDAR_FOCUS_EVENT_KEY);
    if (id) sessionStorage.removeItem(CALENDAR_FOCUS_EVENT_KEY);
    return id;
  } catch {
    return null;
  }
}
