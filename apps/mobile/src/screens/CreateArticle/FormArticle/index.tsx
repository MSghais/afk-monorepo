"use dom";

import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';

// import { ToolbarPlugin } from "@lexical/react/LexicalToolbarPlugin";
import { $getRoot, $getSelection } from 'lexical';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { useSendArticle, useSendVideoEvent } from 'afk_nostr_sdk';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import React from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, TextInput, View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GalleryIcon, SendIconContained, VideoIcon } from '../../../assets/icons';
import { LoadingSpinner } from '../../../components/Loading';
import VideoPlayer from '../../../components/VideoPlayer';
import { useNostrAuth, useStyles, useTheme } from '../../../hooks';
import { useFileUpload } from '../../../hooks/api';
import { usePinataVideoUpload } from '../../../hooks/api/useFileUpload';
import { useToast } from '../../../hooks/modals';
import { MainStackNavigationProps } from '../../../types';
import { SelectedTab } from '../../../types/tab';
import { getImageRatio } from '../../../utils/helpers';
import stylesheet from './styles';
import { ToolbarPlugin } from "./Toolbar";
import RichEditorForm from "./RichEditor";
import QuillEditorForm from './QuillEditor';
// import MDEditor from '@uiw/react-md-editor';
import MdEditor from 'react-markdown-editor-lite';
import { MarkdownIt } from "react-native-markdown-display";
// import style manually
import 'react-markdown-editor-lite/lib/index.css';
import { Input } from "src/components";

// Lexical React plugins are React components, which makes them
// highly composable. Furthermore, you can lazy load plugins if
// desired, so you don't pay the cost for plugins until you
// actually use them.
function MyCustomAutoFocusPlugin() {
  const [editor] = useLexicalComposerContext();



  useEffect(() => {
    // Focus the editor when the effect fires!
    editor.focus();
  }, [editor]);

  return null;
}


export const FormCreateArticle: React.FC = () => {
  const placeholder = "Enter some rich text...";

  // When the editor changes, you can get notified via the
  // LexicalOnChangePlugin!
  function onChange(editorState) {
    editorState.read(() => {
      // Read the contents of the EditorState here.
      const root = $getRoot();
      const selection = $getSelection();

      console.log(root, selection);
    });
  }

  const editorConfig = {
    namespace: "React.js Demo",
    nodes: [],
    // Handling of errors during update
    onError(error: Error) {
      throw error;
    },
    // The editor theme
    theme: {
      paragraph: 'editor-paragraph',
      text: {
        bold: 'editor-text-bold',
        italic: 'editor-text-italic',
        underline: 'editor-text-underline',
        strikethrough: 'editor-text-strikethrough',
        underlineStrikethrough: 'editor-text-underline-strikethrough',
      },
    },
  };

  const onError = useCallback((error: Error) => {
    console.error(error);
    showToast({
      type: 'error',
      title: 'Error! Note could not be sent. Please try again later.',
    });
  }, []);

  const { theme } = useTheme();
  const initialConfig = {
    namespace: 'MyEditor',
    theme,
    onError,
  };

  const styles = useStyles(stylesheet);
  const fileUpload = useFileUpload();
  const sendArticle = useSendArticle();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [note, setNote] = useState<string | undefined>();
  const [title, setTitle] = useState<string | undefined>();
  const [summary, setSummary] = useState<string | undefined>();
  const [value, setValue] = useState<string | undefined>();
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | undefined>();
  const [selectedTab, setSelectedTab] = useState<SelectedTab | undefined>(SelectedTab.NOTES);
  const navigation = useNavigation<MainStackNavigationProps>();
  const { handleCheckNostrAndSendConnectDialog } = useNostrAuth();

  const [editorState, setEditorState] = useState<string | undefined>();
  const [plainText, setPlainText] = useState<string | undefined>();
  const videoPinataUpload = usePinataVideoUpload();
  const sendVideoEvent = useSendVideoEvent();
  const [video, setVideo] = useState<ImagePicker.ImagePickerAsset | any>();

  const [tags, setTags] = useState<string[][]>([]);
  const inputRef = useRef<TextInput>(null);

  const onGalleryPress = async () => {
    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      allowsMultipleSelection: false,
      selectionLimit: 1,
      exif: false,
      quality: 0.75,
    });

    if (pickerResult.canceled || !pickerResult.assets.length) return;
    setImage(pickerResult.assets[0]);
  };

  const handleVideoSelect = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
      selectionLimit: 1,
      exif: false,
      quality: 1,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      setVideo(asset);
    }
  };


  const handleImageUpload = async (image: ImagePicker.ImagePickerAsset) => {
    setImage(image);

    let imageUrl: string | undefined;
    if (image) {
      const result = await fileUpload.mutateAsync(image);
      if (result.data.url) imageUrl = result.data.url;
    }

    return imageUrl;
  };

  const handlesendArticle = async () => {
    // if (!note || note?.trim()?.length == 0) {
    //   showToast({type: 'error', title: 'Please write your note'});
    //   return;
    // }

    if (!note?.trim().length && !image && !video) {
      showToast({ type: 'error', title: 'Please add a note, image, or video' });
      return;
    }

    const isAuth = await handleCheckNostrAndSendConnectDialog();
    if (!isAuth) return;

    let imageUrl: string | undefined;

    if (image) {
      try {
        const result = await fileUpload.mutateAsync(image);
        if (result.data.url) imageUrl = result.data.url;
      } catch (error) {
        console.log('image upload error', error);
      }
    }
    try {
      sendArticle.mutate(
        {
          content: note || '',
          tags: [
            ...tags,
            ...(image && imageUrl ? [['image', imageUrl, `${image.width}x${image.height}`]] : []),
            ['title', title],
            ['summary', summary],
            ['published_at', Math.floor(Date.now() / 1000).toString()],
          ],
        },
        {
          onSuccess() {
            showToast({ type: 'success', title: 'Note sent successfully' });
            queryClient.invalidateQueries({ queryKey: ['rootNotes'] });
            navigation.goBack();
          },
          onError(e) {
            console.log('error', e);
            showToast({
              type: 'error',
              title: 'Error! Note could not be sent. Please try again later.',
            });
          },
        },
      );
    } catch (error) {
      console.log('sendArticle error', error);
    }

    if (video) {
      videoPinataUpload.mutate(video, {
        onSuccess(data) {
          const videoMetadata = {
            dimension: `${video.width}x${video.height}`,
            url: data.url,
            sha256: data.id, // Assuming ipfs hash is SHA256
            mimeType: 'video/mp4', //Making this default
            imageUrls: [], // Thumbnail can be added future
            fallbackUrls: [],
            useNip96: false,
          };
          sendArticle.mutate(
            {
              content: note || '',
              tags: [
                ...tags,
                ...(image && imageUrl ? [['image', imageUrl, `${image.width}x${image.height}`]] : []),
                ['title', title],
                ['summary', summary],
                ['published_at', Math.floor(Date.now() / 1000).toString()],
              ],
            },
            {
              onSuccess() {
                showToast({ type: 'success', title: 'Note sent successfully' });
                queryClient.invalidateQueries({ queryKey: ['rootNotes'] });
                navigation.goBack();
              },
              onError(e) {
                console.log('error', e);
                showToast({
                  type: 'error',
                  title: 'Error! Note could not be sent. Please try again later.',
                });
              },
            },
          );
          sendVideoEvent.mutate(
            {
              content: note || '',
              title: 'Video Note',
              publishedAt: Math.floor(Date.now() / 1000),
              isVertical: video?.height > video?.width,
              videoMetadata: [videoMetadata],
              hashtags: tags.map((tag) => tag[1]),
            },
            {
              onSuccess() {
                showToast({ type: 'success', title: 'Note sent successfully' });
                setVideo('');
                setNote('');
              },
              onError(error) {
                console.log(error, 'error');
                showToast({
                  type: 'error',
                  title: 'Error! Note could not be sent. Please try again later.',
                });
              },
            },
          );
        },
        onError() {
          showToast({
            type: 'error',
            title: 'Error! Error Uploading Video',
          });
        },
      });
    }
  };
  const handleTabSelected = (tab: string | SelectedTab, screen?: string) => {
    setSelectedTab(tab as any);
    if (screen) {
      navigation.navigate(screen as any);
    }
  };

  const handleTextChange = (text: string) => {
    setNote(text);

    // Extract hashtags from the text
    const hashtags = text.match(/#\w+/g) || [];

    // Convert hashtags to the required format and update tags state
    const newTags = hashtags.map((tag) => ['t', tag.slice(1)]);
    setTags(newTags);
  };

  // Initialize a markdown parser
  const mdParser = new MarkdownIt(/* Markdown-it options */);

  function handleEditorChange({ html, text }: { html: string; text: string }) {
    console.log('handleEditorChange', html, text);
    setNote(text)
  }

  const handleImageWebUpload = (file: any, callback: any) => {
    console.log('handleImageWebUpload', file, callback);
    const reader = new FileReader()
    reader.onload = () => {
      const convertBase64UrlToBlob = (urlData: string | ArrayBuffer) => {
        let arr = urlData.split(','), mime = arr[0].match(/:(.*?);/)[1]
        let bstr = atob(arr[1])
        let n = bstr.length
        let u8arr = new Uint8Array(n)
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n)
        }
        return new Blob([u8arr], { type: mime })
      }
      const blob = convertBase64UrlToBlob(reader.result)
      console.log('blob', blob);
      console.log('reader.result', reader.result);
      callback(reader?.result)

    }
    reader.readAsDataURL(file)
  }
  return (
    <ScrollView style={styles.container}>
      <KeyboardAvoidingView behavior="padding" style={styles.content}>
        <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.content}>
          <View>
            <Text style={styles.title}>Title</Text>
            <Input
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              numberOfLines={2}
              placeholder="Title of your article"
            />
            <Text style={styles.summary}>Summary</Text>
            <TextInput
              value={summary}
              style={styles.input}
              multiline
              onChangeText={setSummary}
              placeholder="Summary of your article"
            />
            <Text style={styles.summary}>Image</Text>
            <View style={styles.imageContainer}>
              <Pressable onPress={onGalleryPress}>
                <GalleryIcon width="50" height="50" color={theme.colors.red} />
              </Pressable>
            
            </View>
          </View>


          {Platform.OS === 'web' ? (
            <>
              <MdEditor style={{ height: '500px' }} renderHTML={text => mdParser.render(text)}
                onChange={handleEditorChange}
                onImageUpload={handleImageWebUpload}
                // onCustomImageUpload={handleImageWebUpload}

              />
              {/* <MdEditor></MdEditor> */}
              {/* <MdEditor
                value={note}
                onChange={setNote}
              />
              <MdEditor.Markdown source={note} style={{ whiteSpace: 'pre-wrap' }} /> */}
              {/* <QuillEditorForm
                onChange={handleTextChange}
                onImageUpload={handleImageUpload}
              /> */}
            </>

          ) : (
            <LexicalComposer initialConfig={initialConfig}>
              <div className="editor-container">
                <ToolbarPlugin onChange={onChange} />
                <div className="editor-inner">
                  <RichTextPlugin
                    contentEditable={
                      <ContentEditable
                        className="editor-input"
                        aria-placeholder={'Enter some text...'}
                        placeholder={<div>Enter some text...</div>}
                      />
                    }
                    placeholder={<div>Enter some text...</div>}
                    ErrorBoundary={LexicalErrorBoundary}
                  />
                  <OnChangePlugin onChange={onChange} />
                  <HistoryPlugin />
                  <MyCustomAutoFocusPlugin />
                </div>
              </div>
            </LexicalComposer>
          )}
          <View style={styles.buttons}>
            <View
              style={{
                display: 'flex',
                flexDirection: 'row',
              }}
            >
              <View style={styles.mediaButtons}>
                {!video && (
                  <Pressable onPress={onGalleryPress}>
                    <GalleryIcon width="24" height="24" color={theme.colors.red} />
                  </Pressable>
                )}

                {!image && (
                  <Pressable onPress={handleVideoSelect}>
                    <VideoIcon width="30" height="30" color={theme.colors.red} />
                  </Pressable>
                )}
              </View>
            </View>

            {videoPinataUpload.isPending || sendVideoEvent.isPending ? (
              <Pressable style={styles.sendButton}>
                <LoadingSpinner color={theme.colors.text} />
              </Pressable>
            ) : (
              <Pressable style={styles.sendButton} onPress={handlesendArticle}>
                <SendIconContained width="56" height="56" color={theme.colors.primary} />
              </Pressable>
            )}
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ScrollView>
  );
};
