Compress-Archive -Path "chrome-extension\*" -DestinationPath "chrome-extension\pc-stand-modo-kiosk.zip" -Force
Copy-Item "chrome-extension\pc-stand-modo-kiosk.zip" "public\chrome-extension\" -Force