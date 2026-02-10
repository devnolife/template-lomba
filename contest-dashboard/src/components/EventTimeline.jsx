import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { format } from 'date-fns';

const EVENT_ICONS = {
  paste: ContentPasteIcon,
  typing: KeyboardIcon,
  window_blur: VisibilityOffIcon,
  file_operation: InsertDriveFileIcon,
  clipboard: ContentCopyIcon,
};

function EventItem({ event }) {
  const [open, setOpen] = useState(false);
  const Icon = EVENT_ICONS[event.eventType] || WarningAmberIcon;
  const isFlagged = event.flagged || (event.suspicionScore || 0) > 0.3;
  const time = event.timestamp ? format(new Date(event.timestamp), 'HH:mm:ss') : '--:--:--';

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1.5,
        position: 'relative',
        pl: 4,
        pb: 2,
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 15,
          top: 0,
          bottom: 0,
          width: 2,
          bgcolor: isFlagged ? 'error.light' : 'divider',
        },
      }}
    >
      {/* Dot */}
      <Box
        sx={{
          position: 'absolute',
          left: 8,
          top: 4,
          width: 16,
          height: 16,
          borderRadius: '50%',
          bgcolor: isFlagged ? 'error.main' : 'primary.main',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
        }}
      >
        <Icon sx={{ fontSize: 10, color: '#fff' }} />
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {event.eventType}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {time}
          </Typography>
          {isFlagged && (
            <Chip label="Flagged" color="error" size="small" variant="outlined" />
          )}
          {event.suspicionScore > 0 && (
            <Chip
              label={`${Math.round(event.suspicionScore * 100)}%`}
              size="small"
              color={event.suspicionScore > 0.5 ? 'error' : 'warning'}
            />
          )}
          <IconButton size="small" onClick={() => setOpen(!open)}>
            <ExpandMoreIcon
              sx={{
                transform: open ? 'rotate(180deg)' : 'rotate(0)',
                transition: 'transform 0.2s',
                fontSize: 18,
              }}
            />
          </IconButton>
        </Box>
        <Collapse in={open}>
          <Box
            sx={{
              mt: 0.5,
              p: 1,
              bgcolor: 'action.hover',
              borderRadius: 1,
              fontSize: '0.75rem',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {JSON.stringify(event.data || event, null, 2)}
          </Box>
        </Collapse>
      </Box>
    </Box>
  );
}

export default function EventTimeline({ events = [], maxItems = 50 }) {
  const visible = events.slice(0, maxItems);

  if (visible.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
        No events recorded yet.
      </Typography>
    );
  }

  return (
    <Box sx={{ position: 'relative' }}>
      {visible.map((e, i) => (
        <EventItem key={e._id || i} event={e} />
      ))}
      {events.length > maxItems && (
        <Typography variant="caption" color="text.secondary">
          + {events.length - maxItems} more events
        </Typography>
      )}
    </Box>
  );
}
