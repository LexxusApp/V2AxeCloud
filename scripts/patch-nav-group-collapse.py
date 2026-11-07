import re

file_path = "src/components/app/AppTopNav.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update variant === 'drawer'
old_drawer = """  if (variant === 'drawer') {
    return (
      <div className={cn(expanded && 'rounded-xl bg-white/[0.02]')}>
        <button
          type="button"
          onClick={handleHeaderClick}
          aria-expanded={expanded}
          className={cn(
            'flex w-full min-h-[36px] items-center gap-2.5 px-3 py-1.5 text-left text-[13px] font-bold transition-colors touch-manipulation',
            expanded ? 'rounded-t-lg' : 'rounded-lg',
            isGroupActive || expanded
              ? 'bg-primary/15 text-primary'
              : 'text-[#CBD5E1] hover:bg-white/5 hover:text-[#F1F5F9]',
          )}
        >
          <GroupIcon className="h-4 w-4 shrink-0" aria-hidden />
          <span className="flex-1">{label}</span>
          <span
            role="button"
            tabIndex={0}
            onClick={handleToggleExpand}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                setExpanded((o) => !o);
              }
            }}
            className="rounded p-1 text-[#94A3B8] transition hover:bg-white/10 hover:text-[#F1F5F9]"
            aria-label={expanded ? `Recolher ${label}` : `Expandir ${label}`}
          >
            <ChevronDown
              className={cn('h-4 w-4 shrink-0 transition-transform', expanded && 'rotate-180')}
              aria-hidden
            />
          </span>
        </button>"""

new_drawer = """  if (variant === 'drawer') {
    return (
      <div className={cn(expanded && 'rounded-xl bg-white/[0.02]')}>
        <div
          className={cn(
            'flex w-full min-h-[36px] items-center gap-1.5 px-2 py-1 text-left text-[13px] font-bold transition-colors touch-manipulation',
            expanded ? 'rounded-t-lg' : 'rounded-lg',
            isGroupActive || expanded
              ? 'bg-primary/15 text-primary'
              : 'text-[#CBD5E1] hover:bg-white/5 hover:text-[#F1F5F9]',
          )}
        >
          <button
            type="button"
            onClick={() => {
              if (hasDirectNavTarget) {
                if (!expanded) {
                  setExpanded(true);
                  onSelect(items[0]);
                } else if (activeTab === items[0].id) {
                  setExpanded(false);
                } else {
                  onSelect(items[0]);
                }
              } else {
                setExpanded((o) => !o);
              }
            }}
            aria-expanded={expanded}
            className="flex min-w-0 flex-1 items-center gap-2.5 py-1 text-left text-[13px] font-bold text-inherit"
          >
            <GroupIcon className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{label}</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setExpanded((o) => !o);
            }}
            aria-label={expanded ? `Recolher ${label}` : `Expandir ${label}`}
            title={expanded ? `Recolher ${label}` : `Expandir ${label}`}
            className="grid h-7 w-7 shrink-0 place-items-center rounded p-1 text-[#94A3B8] transition hover:bg-white/10 hover:text-[#F1F5F9]"
          >
            <ChevronDown
              className={cn('h-4 w-4 shrink-0 transition-transform', expanded && 'rotate-180')}
              aria-hidden
            />
          </button>
        </div>"""

# 2. Update grid variant
old_grid = """  return (
    <div className="col-span-2 space-y-2 sm:col-span-3">
      <button
        type="button"
        onClick={handleHeaderClick}
        aria-expanded={expanded}
        className={cn(
          'flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-bold transition-colors',
          isGroupActive || expanded
            ? 'border-primary/40 bg-primary/15 text-primary'
            : 'border-[#1E242B] bg-[#12161A] text-[#94A3B8] hover:border-[#94A3B8]/30 hover:text-[#F1F5F9]',
        )}
      >
        <GroupIcon className="h-4 w-4 shrink-0" aria-hidden />
        <span className="flex-1">{label}</span>
        <span
          role="button"
          tabIndex={0}
          onClick={handleToggleExpand}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              setExpanded((o) => !o);
            }
          }}
          className="rounded p-1 text-[#94A3B8] transition hover:bg-white/10 hover:text-[#F1F5F9]"
          aria-label={expanded ? `Recolher ${label}` : `Expandir ${label}`}
        >
          <ChevronDown
            className={cn('h-4 w-4 shrink-0 transition-transform', expanded && 'rotate-180')}
            aria-hidden
          />
        </span>
      </button>"""

new_grid = """  return (
    <div className="col-span-2 space-y-2 sm:col-span-3">
      <div
        className={cn(
          'flex w-full items-center gap-1.5 rounded-xl border px-2 py-1.5 text-left text-xs font-bold transition-colors',
          isGroupActive || expanded
            ? 'border-primary/40 bg-primary/15 text-primary'
            : 'border-[#1E242B] bg-[#12161A] text-[#94A3B8] hover:border-[#94A3B8]/30 hover:text-[#F1F5F9]',
        )}
      >
        <button
          type="button"
          onClick={() => {
            if (hasDirectNavTarget) {
              if (!expanded) {
                setExpanded(true);
                onSelect(items[0]);
              } else if (activeTab === items[0].id) {
                setExpanded(false);
              } else {
                onSelect(items[0]);
              }
            } else {
              setExpanded((o) => !o);
            }
          }}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left text-inherit"
        >
          <GroupIcon className="h-4 w-4 shrink-0" aria-hidden />
          <span className="truncate">{label}</span>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setExpanded((o) => !o);
          }}
          aria-label={expanded ? `Recolher ${label}` : `Expandir ${label}`}
          title={expanded ? `Recolher ${label}` : `Expandir ${label}`}
          className="grid h-6 w-6 shrink-0 place-items-center rounded p-0.5 text-[#94A3B8] transition hover:bg-white/10 hover:text-[#F1F5F9]"
        >
          <ChevronDown
            className={cn('h-4 w-4 shrink-0 transition-transform', expanded && 'rotate-180')}
            aria-hidden
          />
        </button>
      </div>"""

# Normalize \r\n to \n for replacement
norm_content = content.replace("\r\n", "\n")
if old_drawer in norm_content:
    norm_content = norm_content.replace(old_drawer, new_drawer)
    print("Replaced old_drawer successfully!")
else:
    print("Could not find old_drawer in content!")

if old_grid in norm_content:
    norm_content = norm_content.replace(old_grid, new_grid)
    print("Replaced old_grid successfully!")
else:
    print("Could not find old_grid in content!")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(norm_content)
print("File updated successfully!")
