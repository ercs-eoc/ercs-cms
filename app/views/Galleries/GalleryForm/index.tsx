import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useParams } from 'react-router';
import {
    CloseLineIcon,
    UploadLineIcon,
} from '@ifrc-go/icons';
import {
    BlockLoading,
    Button,
    Checkbox,
    ConfirmButton,
    Container,
    Heading,
    IconButton,
    Image,
    InputError,
    InputSection,
    ListView,
    RawFileInput,
    TextInput,
} from '@ifrc-go/ui';
import {
    _cs,
    isDefined,
    isNotDefined,
} from '@togglecorp/fujs';
import {
    createSubmitHandler,
    getErrorObject,
    type ObjectSchema,
    type PartialForm,
    removeNull,
    requiredStringCondition,
    useForm,
} from '@togglecorp/toggle-form';

import NonFieldError from '#components/NonFieldError';
import {
    type GalleryAlbumCreateInput,
    type GalleryAlbumUpdateInput,
    type GalleryImageListQuery,
    useBulkCreateGalleryImagesMutation,
    useCreateGalleryAlbumMutation,
    useDeleteGalleryImageMutation,
    useGalleryAlbumDetailQuery,
    useGalleryImageListQuery,
    useUpdateGalleryAlbumMutation,
} from '#generated/types/graphql';
import useAlert from '#hooks/useAlert';
import useRouting from '#hooks/useRouting';
import {
    ACCEPTED_IMAGE_TYPES,
    errorMessage,
    MAX_IMAGE_SIZE,
    transformToFormError,
    validateFile,
} from '#utils/common';

import styles from './styles.module.css';

type PartialFormType = PartialForm<GalleryAlbumCreateInput>;
type FormSchema = ObjectSchema<PartialFormType>;
type FormSchemaFields = ReturnType<FormSchema['fields']>;

const GalleryAlbumSchema: FormSchema = {
    fields: (): FormSchemaFields => ({
        title: {
            required: true,
            requiredValidation: requiredStringCondition,
        },
    }),
};

const defaultEditFormValue: PartialFormType = {};

const IMAGES_PER_PAGE = 10;

const MAX_ALBUM_IMAGES = 100;

type GalleryImage = GalleryImageListQuery['galleryImages']['results'][number];

function getDisplayName(name: string) {
    return name.split('/').pop()?.replace(/\.[^.]+$/, '') ?? name;
}

interface NewImage {
    file: File;
    preview: string;
}

function GalleryForm() {
    const { id } = useParams();
    const navigate = useRouting();
    const alert = useAlert();

    const [newImages, setNewImages] = useState<NewImage[]>([]);
    const [fileErrors, setFileErrors] = useState<string[]>([]);
    const [removedImageIds, setRemovedImageIds] = useState<string[]>([]);
    const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);

    const {
        setFieldValue,
        error: formError,
        value,
        validate,
        setError,
        setValue,
    } = useForm(GalleryAlbumSchema, { value: defaultEditFormValue });

    const [{ data, fetching: albumDetailFetch }] = useGalleryAlbumDetailQuery({
        variables: { id: (id ?? '') }, pause: !id,
    });

    const [imagesOffset, setImagesOffset] = useState(0);
    const [loadedImages, setLoadedImages] = useState<GalleryImage[]>([]);
    const [totalImages, setTotalImages] = useState(0);

    const [{ data: imagesData, fetching: imagesFetch }] = useGalleryImageListQuery({
        variables: {
            filters: { albumId: id ?? '' },
            offset: imagesOffset,
            limit: IMAGES_PER_PAGE,
        },
        pause: !id,
        requestPolicy: 'network-only',
    });

    const [{ fetching: createGalleryPending }, createAlbum] = useCreateGalleryAlbumMutation();
    const [{ fetching: updateGalleryPending }, updateAlbum] = useUpdateGalleryAlbumMutation();
    const [, addImagesToGallery] = useBulkCreateGalleryImagesMutation();
    const [, deleteImagesFromGallery] = useDeleteGalleryImageMutation();

    const albumData = data?.galleryAlbum;

    useEffect(() => {
        if (!albumDetailFetch && isDefined(albumData)) {
            setValue(removeNull({
                title: albumData.title,
            }));
        }
    }, [albumDetailFetch, albumData, setValue]);

    const appendedImagesData = useRef<GalleryImageListQuery | undefined>(undefined);

    useEffect(() => {
        if (imagesFetch || isNotDefined(imagesData) || appendedImagesData.current === imagesData) {
            return;
        }
        appendedImagesData.current = imagesData;
        setLoadedImages((prevImages) => [...prevImages, ...imagesData.galleryImages.results]);
        setTotalImages(imagesData.galleryImages.totalCount);
    }, [imagesData, imagesFetch]);

    const existingImages = useMemo(() => (
        loadedImages.filter((image) => !removedImageIds.includes(image.id))
    ), [loadedImages, removedImageIds]);

    const loadedImagesCount = loadedImages.length;
    const savedImagesCount = totalImages - removedImageIds.length;
    const remainingImageSlots = MAX_ALBUM_IMAGES - savedImagesCount - newImages.length;
    const hasMoreImages = loadedImagesCount < totalImages;

    const handleLoadMoreClick = useCallback(() => {
        setImagesOffset(loadedImagesCount);
    }, [loadedImagesCount]);

    const topUpLoadedImages = useCallback((remainingCount: number) => {
        if (!imagesFetch && hasMoreImages && remainingCount < IMAGES_PER_PAGE) {
            setImagesOffset(loadedImagesCount);
        }
    }, [imagesFetch, hasMoreImages, loadedImagesCount]);

    const previewUrlsRef = useRef<string[]>([]);

    useEffect(() => {
        previewUrlsRef.current = newImages.map(({ preview }) => preview);
    }, [newImages]);

    useEffect(() => () => {
        previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    }, []);

    const handleFilesSelect = useCallback((files: File[] | undefined) => {
        if (isNotDefined(files) || files.length === 0) {
            return;
        }
        const rejected: string[] = [];
        const accepted = files.filter((file) => {
            const message = validateFile(file, MAX_IMAGE_SIZE, ACCEPTED_IMAGE_TYPES);
            if (isDefined(message)) {
                rejected.push(`${file.name}: ${message}`);
                return false;
            }
            return true;
        });
        const allowed = accepted.slice(0, Math.max(remainingImageSlots, 0));
        if (allowed.length < accepted.length) {
            const limitMessage = `An album can have at most ${MAX_ALBUM_IMAGES} images, so the remaining images could not be added.`;
            rejected.push(limitMessage);
            alert.show(limitMessage, { variant: 'danger' });
        }
        setFileErrors(rejected);
        if (allowed.length === 0) {
            return;
        }
        const acceptedWithPreviews = allowed.map((file) => ({
            file,
            preview: URL.createObjectURL(file),
        }));
        setNewImages((prev) => [...prev, ...acceptedWithPreviews]);
    }, [remainingImageSlots, alert]);

    const handleRemoveExistingImage = useCallback((imageId: string) => {
        setRemovedImageIds((prev) => [...prev, imageId]);
        setSelectedImageIds((prev) => prev.filter((selectedId) => selectedId !== imageId));
        topUpLoadedImages(existingImages.length - 1);
    }, [existingImages.length, topUpLoadedImages]);

    const handleRemoveNewImage = useCallback((index: number) => {
        setNewImages((prev) => {
            URL.revokeObjectURL(prev[index].preview);
            return prev.filter((_, imageIndex) => imageIndex !== index);
        });
    }, []);

    const handleImageSelect = useCallback((selected: boolean, imageId: string) => {
        setSelectedImageIds((prev) => (
            selected
                ? [...prev, imageId]
                : prev.filter((selectedId) => selectedId !== imageId)
        ));
    }, []);

    const allImagesSelected = existingImages.length > 0
        && selectedImageIds.length === existingImages.length;

    const handleSelectAllChange = useCallback((selected: boolean) => {
        setSelectedImageIds(selected ? existingImages.map((image) => image.id) : []);
    }, [existingImages]);

    const handleRemoveSelectedClick = useCallback(() => {
        setRemovedImageIds((prev) => [...prev, ...selectedImageIds]);
        setSelectedImageIds([]);
        topUpLoadedImages(existingImages.length - selectedImageIds.length);
    }, [selectedImageIds, existingImages.length, topUpLoadedImages]);

    const handleGalleryImages = useCallback(async (albumId: string) => {
        const deleteResponses = await Promise.all(
            removedImageIds.map((imageId) => deleteImagesFromGallery({ id: imageId })),
        );
        const deleteFailed = deleteResponses.some(
            (res) => !res.data?.deleteGalleryImage?.ok,
        );

        let uploadFailed = false;
        let uploadedImageIds: string[] = [];
        if (newImages.length > 0) {
            const uploadRes = await addImagesToGallery({
                data: {
                    images: newImages.map(({ file }, index) => ({
                        album: albumId,
                        image: file,
                        order: savedImagesCount + index,
                    })),
                },
            });
            const uploadResult = uploadRes.data?.bulkCreateGalleryImages;
            uploadFailed = !uploadResult?.ok;
            uploadedImageIds = uploadResult?.result?.map((image) => image.id) ?? [];
        }
        let coverFailed = false;
        if (existingImages.length === 0 && uploadedImageIds.length > 0) {
            const coverRes = await updateAlbum({
                id: albumId,
                data: { coverImage: uploadedImageIds[0] },
            });
            coverFailed = !coverRes.data?.updateGalleryAlbum?.ok;
        }

        return deleteFailed || uploadFailed || coverFailed;
    }, [
        updateAlbum,
        addImagesToGallery,
        deleteImagesFromGallery,
        removedImageIds,
        existingImages,
        newImages,
        savedImagesCount,
    ]);

    const handleCreateGallery = useCallback(async (formData: PartialFormType) => {
        setSubmitting(true);
        try {
            const res = await createAlbum({
                data: formData as GalleryAlbumCreateInput,
            });
            const result = res.data?.createGalleryAlbum;
            if (!result?.ok || !result.result?.id) {
                if (isDefined(result) && isDefined(result.errors)) {
                    setError(transformToFormError(result.errors));
                }
                alert.show(errorMessage, { variant: 'danger' });
                return;
            }

            const imagesFailed = await handleGalleryImages(result.result.id);
            if (imagesFailed) {
                alert.show(
                    'Gallery saved, but some images could not be updated. Please review and try again.',
                    { variant: 'warning' },
                );
            } else {
                alert.show('Gallery created successfully', { variant: 'success' });
            }
            navigate('galleries');
        } catch {
            alert.show(errorMessage, { variant: 'danger' });
        } finally {
            setSubmitting(false);
        }
    }, [
        alert,
        navigate,
        setError,
        createAlbum,
        handleGalleryImages,
    ]);

    const handleUpdateGallery = useCallback(async (formData: PartialFormType) => {
        if (!id) {
            return;
        }
        setSubmitting(true);
        try {
            const res = await updateAlbum({
                id,
                data: {
                    ...formData,
                    coverImage: existingImages[0]?.id,
                } as GalleryAlbumUpdateInput,
            });
            const result = res.data?.updateGalleryAlbum;
            if (!result?.ok) {
                if (isDefined(result) && isDefined(result.errors)) {
                    setError(transformToFormError(result.errors));
                }
                alert.show(errorMessage, { variant: 'danger' });
                return;
            }

            const imagesFailed = await handleGalleryImages(id);
            if (imagesFailed) {
                alert.show(
                    'Gallery saved, but some images could not be updated. Please review and try again.',
                    { variant: 'warning' },
                );
            } else {
                alert.show('Gallery updated successfully', { variant: 'success' });
            }
            navigate('galleries');
        } catch {
            alert.show(errorMessage, { variant: 'danger' });
        } finally {
            setSubmitting(false);
        }
    }, [
        id,
        alert,
        navigate,
        setError,
        updateAlbum,
        handleGalleryImages,
        existingImages,
    ]);

    const handleFormSubmit = useCallback(
        () => createSubmitHandler(
            validate,
            setError,
            isDefined(id) ? handleUpdateGallery : handleCreateGallery,
        )(),
        [validate, setError, id, handleUpdateGallery, handleCreateGallery],
    );

    const saveConfirmMessage = [
        'Are you sure you want to save this gallery?',
        newImages.length > 0 && `${newImages.length} image(s) will be uploaded.`,
        removedImageIds.length > 0 && `${removedImageIds.length} image(s) will be deleted.`,
    ].filter(Boolean).join(' ');

    const handleCancelClick = useCallback(() => {
        navigate('galleries');
    }, [navigate]);

    const error = getErrorObject(formError);

    if (albumDetailFetch || (imagesFetch && loadedImagesCount === 0)) {
        return (
            <BlockLoading
                withoutBorder
                compact
                message="Loading"
            />
        );
    }

    return (
        <Container
            heading={id ? 'Edit Gallery' : 'Create New Galleries'}
            headerDescription={id
                ? 'Manage and update the gallery images and details'
                : 'Build a new gallery by adding images and relevant details to showcase visual content in a clear and organized manner'}
            withPadding
            footerActions={(
                <ListView>
                    <Button
                        name={undefined}
                        onClick={handleCancelClick}
                        disabled={submitting}
                    >
                        Cancel
                    </Button>
                    <ConfirmButton
                        name={undefined}
                        onConfirm={handleFormSubmit}
                        confirmHeading="Save gallery"
                        confirmMessage={saveConfirmMessage}
                        styleVariant="filled"
                        disabled={
                            submitting
                            || createGalleryPending
                            || updateGalleryPending
                        }
                    >
                        Save
                    </ConfirmButton>
                </ListView>
            )}
        >
            <ListView layout="block">
                <NonFieldError
                    error={formError}
                    withFallbackError
                />
                <InputSection
                    title="Event Name"
                    description="Enter the name of the event"
                    withAsteriskOnTitle
                >
                    <TextInput
                        name="title"
                        value={value.title}
                        onChange={setFieldValue}
                        error={error?.title}
                        disabled={submitting}
                    />
                </InputSection>
                <InputSection
                    title="Add Content"
                    description={`Upload images for the event (${MAX_ALBUM_IMAGES - remainingImageSlots}/${MAX_ALBUM_IMAGES})`}
                >
                    <RawFileInput
                        name={undefined}
                        multiple
                        accept={ACCEPTED_IMAGE_TYPES}
                        disabled={submitting || remainingImageSlots <= 0}
                        onChange={handleFilesSelect}
                        className={_cs(
                            styles.uploadTile,
                            (submitting || remainingImageSlots <= 0) && styles.disabled,
                        )}
                        childrenContainerClassName={styles.uploadTileContent}
                        styleVariant="action"
                        withoutPadding
                    >
                        <UploadLineIcon className={styles.uploadIcon} />
                        <Heading level={5}>
                            Click to upload images
                        </Heading>
                    </RawFileInput>
                    {existingImages.length > 0 && (
                        <ListView>
                            <Checkbox
                                name={undefined}
                                value={allImagesSelected}
                                indeterminate={selectedImageIds.length > 0 && !allImagesSelected}
                                onChange={handleSelectAllChange}
                                label={`Select all (${selectedImageIds.length}/${existingImages.length})`}
                                disabled={submitting}
                            />
                            <Button
                                name={undefined}
                                onClick={handleRemoveSelectedClick}
                                colorVariant="danger"
                                disabled={submitting || selectedImageIds.length === 0}
                            >
                                Delete selected
                            </Button>
                        </ListView>
                    )}
                    <ListView
                        layout="grid"
                        numPreferredGridColumns={5}
                    >
                        {existingImages.map((image) => (
                            <div className={styles.fileItem} key={image.id}>
                                <Checkbox
                                    className={_cs(
                                        styles.selectCheckbox,
                                        selectedImageIds.includes(image.id) && styles.selected,
                                    )}
                                    name={image.id}
                                    value={selectedImageIds.includes(image.id)}
                                    onChange={handleImageSelect}
                                    disabled={submitting}
                                    tooltip="Select image"
                                />
                                <Image
                                    imgElementClassName={styles.imageElement}
                                    src={image.image.url}
                                    alt={image.image.name}
                                    caption={(
                                        <Heading level={6} ellipsize>
                                            {getDisplayName(image.image.name)}
                                        </Heading>
                                    )}
                                    size="md"
                                    withContainedFit
                                />
                                <IconButton
                                    className={styles.removeButton}
                                    name={image.id}
                                    title="Remove image"
                                    ariaLabel="Remove image"
                                    onClick={handleRemoveExistingImage}
                                    variant="secondary"
                                    disabled={submitting}
                                >
                                    <CloseLineIcon />
                                </IconButton>
                            </div>
                        ))}
                        {newImages.map(({ file, preview }, index) => (
                            <div
                                key={preview}
                                className={styles.fileItem}
                            >
                                <Image
                                    imgElementClassName={styles.imageElement}
                                    src={preview}
                                    alt={file.name}
                                    caption={(
                                        <Heading level={6} ellipsize>
                                            {getDisplayName(file.name)}
                                        </Heading>
                                    )}
                                    size="md"
                                    withContainedFit
                                />
                                <IconButton
                                    className={styles.removeButton}
                                    name={index}
                                    title="Remove image"
                                    ariaLabel="Remove image"
                                    onClick={handleRemoveNewImage}
                                    variant="secondary"
                                    disabled={submitting}
                                >
                                    <CloseLineIcon />
                                </IconButton>
                            </div>
                        ))}
                    </ListView>
                    {hasMoreImages && (
                        <div className={styles.loadMore}>
                            <Button
                                name={undefined}
                                onClick={handleLoadMoreClick}
                                disabled={imagesFetch || submitting}
                            >
                                {imagesFetch ? 'Loading' : 'Show more'}
                            </Button>
                        </div>
                    )}
                    {fileErrors.map((fileError) => (
                        <InputError key={fileError}>
                            {fileError}
                        </InputError>
                    ))}
                </InputSection>
            </ListView>
        </Container>
    );
}

export default GalleryForm;
