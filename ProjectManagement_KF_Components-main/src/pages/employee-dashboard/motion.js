export const EMP_MOTION = {
  hoverLift: {
    y: -2,
    transition: { type: 'spring', stiffness: 320, damping: 24 },
  },
  tapPress: {
    scale: 0.98,
    transition: { type: 'spring', stiffness: 520, damping: 28 },
  },
  rowTap: {
    scale: 0.996,
    transition: { type: 'spring', stiffness: 520, damping: 28 },
  },
  sectionEnter: {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.42, ease: 'easeOut' },
  },
  modalBackdrop: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.22 },
  },
  modalPanel: {
    initial: { opacity: 0, y: 36, scale: 0.985 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: 24, scale: 0.985 },
    transition: { type: 'spring', stiffness: 240, damping: 24 },
  },
  counter: {
    duration: 0.8,
    ease: 'easeOut',
  },
};

