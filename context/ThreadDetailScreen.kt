package com.berriz.reader.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.outlined.AutoStories
import androidx.compose.material.icons.outlined.Translate
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.io.File
import com.berriz.reader.data.PostThread
import com.berriz.reader.ui.components.*
import com.berriz.reader.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ThreadDetailScreen(
    thread: PostThread,
    showTranslations: Boolean,
    showCulturalNotes: Boolean,
    baseMediaDir: File? = null,
    onToggleTranslations: () -> Unit,
    onToggleCulturalNotes: () -> Unit,
    onBack: () -> Unit
) {
    val isArtistPost = thread.boardName == "From. IU"

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        BoardBadge(thread.boardName)
                        Text(
                            text = "${thread.artistComments.size} responses",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    // Translation toggle
                    IconButton(onClick = onToggleTranslations) {
                        Icon(
                            Icons.Outlined.Translate,
                            contentDescription = "Toggle translations",
                            tint = if (showTranslations) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    // Cultural notes toggle
                    IconButton(onClick = onToggleCulturalNotes) {
                        Icon(
                            Icons.Outlined.AutoStories,
                            contentDescription = "Toggle cultural notes",
                            tint = if (showCulturalNotes) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    navigationIconContentColor = MaterialTheme.colorScheme.onSurface
                )
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Original post card
            item {
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        // Author row
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            if (isArtistPost) {
                                ArtistAvatar(size = 36)
                            } else {
                                UserAvatar(thread.postWriterName, size = 36)
                            }
                            Column {
                                Text(
                                    text = thread.postWriterName ?: "Unknown",
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isArtistPost) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface
                                )
                                Text(
                                    text = DateUtils.formatFull(thread.postCreatedAt),
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }

                        // Post body
                        if (!thread.postBody.isNullOrBlank()) {
                            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant, thickness = 0.5.dp)
                            Text(
                                text = thread.postBody,
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurface,
                                lineHeight = 24.sp
                            )
                            if (showTranslations && !thread.postBodyEn.isNullOrBlank()) {
                                Surface(
                                    shape = RoundedCornerShape(8.dp),
                                    color = Latte.copy(alpha = 0.5f)
                                ) {
                                    Text(
                                        text = thread.postBodyEn,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        fontStyle = FontStyle.Italic,
                                        modifier = Modifier.padding(8.dp),
                                        lineHeight = 20.sp
                                    )
                                }
                            }
                            if (showCulturalNotes && !thread.postCulturalNotes.isNullOrBlank()) {
                                Surface(
                                    shape = RoundedCornerShape(10.dp),
                                    color = Latte.copy(alpha = 0.7f)
                                ) {
                                    Column(modifier = Modifier.padding(10.dp)) {
                                        Text(
                                            text = "Cultural Context",
                                            style = MaterialTheme.typography.labelSmall,
                                            fontWeight = FontWeight.SemiBold,
                                            color = WarmBrown
                                        )
                                        Spacer(Modifier.height(3.dp))
                                        Text(
                                            text = thread.postCulturalNotes,
                                            style = MaterialTheme.typography.labelSmall,
                                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.85f),
                                            lineHeight = 16.sp
                                        )
                                    }
                                }
                            }
                        } else if (thread.isDeleted) {
                            Text(
                                text = "[This post has been deleted]",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                fontStyle = FontStyle.Italic
                            )
                        } else if (thread.postMedia.isEmpty()) {
                            Text(
                                text = "[Post content unavailable]",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                fontStyle = FontStyle.Italic
                            )
                        }

                        if (thread.postMedia.isNotEmpty()) {
                            if (thread.postBody.isNullOrBlank() && !thread.isDeleted) {
                                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant, thickness = 0.5.dp)
                            }
                            MediaAttachmentViewer(mediaFiles = thread.postMedia, baseMediaDir = baseMediaDir)
                        }
                    }
                }
            }

            // Section header for artist responses
            item {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.padding(vertical = 4.dp)
                ) {
                    Icon(
                        Icons.Filled.MusicNote,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(16.dp)
                    )
                    Text(
                        text = "Artist Responses",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    HorizontalDivider(
                        color = ArtistPurpleSoft,
                        thickness = 1.dp,
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            // Artist comments
            items(
                items = thread.artistComments,
                key = { it.id }
            ) { comment ->
                ArtistCommentCard(
                    comment = comment,
                    showTranslations = showTranslations,
                    showCulturalNotes = showCulturalNotes,
                    baseMediaDir = baseMediaDir
                )
                if (comment != thread.artistComments.last()) {
                    HorizontalDivider(
                        color = MaterialTheme.colorScheme.outlineVariant,
                        thickness = 0.5.dp,
                        modifier = Modifier.padding(vertical = 4.dp, horizontal = 8.dp)
                    )
                }
            }

            // Bottom spacer
            item {
                Spacer(Modifier.height(32.dp))
            }
        }
    }
}
