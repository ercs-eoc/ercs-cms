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
    useCreateGalleryAlbumMutation,
    useCreateGalleryImageMutation,
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

// Number of images fetched per page in the edit view.
const IMAGES_PER_PAGE = 10;

type GalleryImage = GalleryImageListQuery['galleryImages']['results'][number];

function getDisplayName(name: string) {
    return name.split('/').pop()?.replace(/\.[^.]+$/, '') ?? name;
}

interface NewImage {
    file: File;
    preview: string;
}

interface ExistingImage {
    id: string;
    name: string;
    size: number;
    url: string;
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
    const [, addImagesToGallery] = useCreateGalleryImageMutation();
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

    const existingImages: ExistingImage[] = useMemo(() => (
        loadedImages
            .filter((image) => !removedImageIds.includes(image.id))
            .map((image) => ({
                id: image.id,
                name: image.image.name,
                size: image.image.size,
                url: image.image.url,
            }))
    ), [loadedImages, removedImageIds]);

    const loadedImagesCount = loadedImages.length;
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
        setFileErrors(rejected);
        if (accepted.length === 0) {
            return;
        }
        const acceptedWithPreviews = accepted.map((file) => ({
            file,
            preview: URL.createObjectURL(file),
        }));
        setNewImages((prev) => [...prev, ...acceptedWithPreviews]);
    }, []);

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

        const uploadResponses = await Promise.all(
            newImages.map(({ file }, index) => addImagesToGallery({
                data: {
                    album: albumId,
                    image: file,
                    order: existingImages.length + index,
                },
            })),
        );
        const uploadFailed = uploadResponses.some(
            (res) => !res.data?.createGalleryImage?.ok,
        );

        const uploadedImageIds = uploadResponses
            .map((res) => res.data?.createGalleryImage?.result?.id)
            .filter(isDefined);
        const coverImageId = existingImages[0]?.id ?? uploadedImageIds[0];

        let coverFailed = false;
        if (coverImageId) {
            const coverRes = await updateAlbum({
                id: albumId,
                data: { coverImage: coverImageId },
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
                data: formData as GalleryAlbumUpdateInput,
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
    ]);

    const handleFormSubmit = useCallback(
        () => createSubmitHandler(
            validate,
            setError,
            isDefined(id) ? handleUpdateGallery : handleCreateGallery,
        )(),
        [validate, setError, id, handleUpdateGallery, handleCreateGallery],
    );

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
                    <Button
                        name={undefined}
                        onClick={handleFormSubmit}
                        styleVariant="filled"
                        disabled={
                            submitting
                            || createGalleryPending
                            || updateGalleryPending
                        }
                    >
                        Save
                    </Button>
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
                    description="Upload Images for the event"
                >
                    <RawFileInput
                        name={undefined}
                        multiple
                        accept={ACCEPTED_IMAGE_TYPES}
                        disabled={submitting}
                        onChange={handleFilesSelect}
                        className={_cs(
                            styles.uploadTile,
                            submitting && styles.disabled,
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
                            <ConfirmButton
                                name={undefined}
                                onConfirm={handleRemoveSelectedClick}
                                confirmHeading="Delete images"
                                confirmMessage={`Are you sure you want to delete ${selectedImageIds.length} selected image(s)?`}
                                colorVariant="danger"
                                disabled={submitting || selectedImageIds.length === 0}
                            >
                                Delete selected
                            </ConfirmButton>
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
                                    src={image.url}
                                    alt={image.name}
                                    caption={(
                                        <Heading level={6} ellipsize>
                                            {getDisplayName(image.name)}
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
