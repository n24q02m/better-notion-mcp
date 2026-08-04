EVENT_TITLE="chore: backend-only analysis"
# Test the original problem logic
if [[ ! "$EVENT_TITLE" =~ ^🛡️\ Sentinel:.* ]] && [[ ! "$EVENT_TITLE" =~ ^⚡\ Bolt:.* ]] && [[ ! "$EVENT_TITLE" =~ ^🎨\ Palette:.* ]]; then
  echo "Will run PR title check"
else
  echo "Will SKIP PR title check"
fi
