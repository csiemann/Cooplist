$api = 'http://localhost:3000/api'
function Post($path, $body, $token) {
    $uri = "$api$path"
    $headers = @{}
    if ($token) { $headers['Authorization'] = "Bearer $token" }
    try {
        $res = Invoke-RestMethod -Uri $uri -Method Post -Body ($body | ConvertTo-Json -Depth 5) -ContentType 'application/json' -Headers $headers -ErrorAction Stop
        return @{ status = 200; data = $res }
    } catch [System.Net.WebException] {
        $resp = $_.Exception.Response
        if ($resp -ne $null) {
            $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
            $text = $sr.ReadToEnd();
            try { $json = $text | ConvertFrom-Json } catch { $json = $text }
            return @{ status = $resp.StatusCode.value__; data = $json }
        }
        return @{ status = 0; data = $_.Exception.Message }
    } catch {
        return @{ status = 0; data = $_.Exception.Message }
    }
}
function Get($path, $token) {
    $uri = "$api$path"
    $headers = @{}
    if ($token) { $headers['Authorization'] = "Bearer $token" }
    try {
        $res = Invoke-RestMethod -Uri $uri -Method Get -Headers $headers -ErrorAction Stop
        return @{ status = 200; data = $res }
    } catch [System.Net.WebException] {
        $resp = $_.Exception.Response
        if ($resp -ne $null) {
            $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
            $text = $sr.ReadToEnd();
            try { $json = $text | ConvertFrom-Json } catch { $json = $text }
            return @{ status = $resp.StatusCode.value__; data = $json }
        }
        return @{ status = 0; data = $_.Exception.Message }
    } catch {
        return @{ status = 0; data = $_.Exception.Message }
    }
}
Write-Output "1) Login admin"
$adminLogin = Post '/auth/login' @{ email='admin@admin.com'; password='admin1' } $null
Write-Output ("admin login -> {0} {1}" -f $adminLogin.status, ($adminLogin.data | ConvertTo-Json -Depth 5))
$adminToken = $adminLogin.data.token

Write-Output "2) Login moderator"
$modLogin = Post '/auth/login' @{ email='moderador@moderador.com'; password='moderador' } $null
Write-Output ("mod login -> {0} {1}" -f $modLogin.status, ($modLogin.data | ConvertTo-Json -Depth 5))
$modToken = $modLogin.data.token

if (-not $adminToken) { Write-Error 'Admin token missing'; exit 1 }

Write-Output "3) Get playlists as admin"
$pls = Get '/playlists' $adminToken
Write-Output ("playlists -> {0} {1}" -f $pls.status, ($pls.data | ConvertTo-Json -Depth 5))

$playlistId = $null
if ($pls.data -is [System.Array] -and $pls.data.Count -gt 0) {
    $playlistId = $pls.data[0].id
    Write-Output ("Using existing playlistId=$playlistId")
} else {
    Write-Output "No playlists found - creating one"
    $created = Post '/playlists' @{ name='auto-test-playlist'; description='created-by-test-script' } $adminToken
    Write-Output ("create playlist -> {0} {1}" -f $created.status, ($created.data | ConvertTo-Json -Depth 5))
    $playlistId = $created.data.playlist.id
}

if (-not $playlistId) { Write-Error 'playlist id missing'; exit 1 }

Write-Output "4) Add song as admin"
$addSong = Post ("/playlists/$playlistId/songs") @{ spotify_track_id='track-admin-1'; track_name='Admin Song 1'; artist_name='Test Artist'; track_duration_ms=200000 } $adminToken
Write-Output ("addSong admin -> {0} {1}" -f $addSong.status, ($addSong.data | ConvertTo-Json -Depth 5))

Write-Output "5) Get playlist details as admin"
$details1 = Get ("/playlists/$playlistId") $adminToken
Write-Output ("details -> {0} {1}" -f $details1.status, ($details1.data | ConvertTo-Json -Depth 7))

Write-Output "6) Add song as moderator"
$addSongMod = Post ("/playlists/$playlistId/songs") @{ spotify_track_id='track-mod-1'; track_name='Mod Song 1'; artist_name='Mod Artist'; track_duration_ms=180000 } $modToken
Write-Output ("addSong mod -> {0} {1}" -f $addSongMod.status, ($addSongMod.data | ConvertTo-Json -Depth 5))

Write-Output "7) Get playlist details as admin after mod add"
$details2 = Get ("/playlists/$playlistId") $adminToken
Write-Output ("details post-mod -> {0} {1}" -f $details2.status, ($details2.data | ConvertTo-Json -Depth 7))

Write-Output "8) Get members and attempt moderator remove admin"
$members = Get ("/playlists/$playlistId/members") $adminToken
Write-Output ("members -> {0} {1}" -f $members.status, ($members.data | ConvertTo-Json -Depth 7))

$adminMemberRow = $null
if ($members.data -is [System.Array]) {
    foreach ($m in $members.data) { if ($m.email -eq 'admin@admin.com') { $adminMemberRow = $m; break } }
}
if (-not $adminMemberRow) { Write-Output 'Could not find admin member row in members response' } else { Write-Output ("Admin member row: {0}" -f ($adminMemberRow | ConvertTo-Json -Depth 5))
    # Need to find playlist_members.id; fetch raw playlist membership rows via a health endpoint is not available. We'll attempt removal using the member's user id as a guess.
    $attemptRemove = Invoke-RestMethod -Uri "$api/playlists/$playlistId/members/$($adminMemberRow.id)" -Method Delete -Headers @{ Authorization = "Bearer $modToken" } -ErrorAction SilentlyContinue -SkipHttpErrorCheck
    if ($LASTEXITCODE -ne $null) { }
    try { $attemptText = $attemptRemove } catch { $attemptText = $null }
    Write-Output ("mod remove admin -> rawResponse: " + ($attemptText | ConvertTo-Json -Depth 5))
}

Write-Output "9) Final playlist details"
$final = Get ("/playlists/$playlistId") $adminToken
Write-Output ("final details -> {0} {1}" -f $final.status, ($final.data | ConvertTo-Json -Depth 7))

Write-Output 'TESTS COMPLETE'