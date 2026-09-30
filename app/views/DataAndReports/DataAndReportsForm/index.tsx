import {
    use,
    useCallback,
    useEffect,
    useMemo,
} from 'react';
import { useParams } from 'react-router';
import {
    BlockLoading,
    Button,
    Container,
    DateInput,
    InputSection,
    ListView,
    RadioInput,
    SelectInput,
    TextArea,
    TextInput,
} from '@ifrc-go/ui';
import {
    encodeDate,
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

import CoverImageInput from '#components/CoverImageInput';
import EmbedPreview from '#components/EmbedPreview';
import FileInput from '#components/FileInput';
import NonFieldError from '#components/NonFieldError';
import RegionSelectInput from '#components/RegionSelectInput';
import UserContext from '#contexts/UserContext';
import {
    AdminAreaLevel,
    ReportContentType,
    type ReportCreateInput,
    ReportTypeEnum,
    type ReportUpdateInput,
    ReportVisibility,
    useCreateReportMutation,
    useReportDetailQuery,
    useThematicAreasQuery,
    useUpdateReportMutation,
} from '#generated/types/graphql';
import useAlert from '#hooks/useAlert';
import useGlobalEnums from '#hooks/useGlobalEnums';
import useRouting from '#hooks/useRouting';
import {
    errorMessage,
    idSelector,
    keySelector,
    labelSelector,
    nameSelector,
    omitKeys,
    safeUrlCondition,
    transformToFormError,
} from '#utils/common';

type PartialFormType = PartialForm<ReportCreateInput>;
type FormSchema = ObjectSchema<PartialFormType>;
type FormSchemaFields = ReturnType<FormSchema['fields']>;

function getReportSchema(isEditing: boolean): FormSchema {
    return {
        fields: (value): FormSchemaFields => {
            const baseFields: FormSchemaFields = {
                title: {
                    required: true,
                    requiredValidation: requiredStringCondition,
                },
                contentType: {
                    required: true,
                },
                description: {},
                coverImage: {},
                disasterType: {},
                owner: {},
                region: {},
                reportType: {
                    required: true,
                },
                visibility: {
                    required: true,
                },
                thematicArea: {
                    required: true,
                },
                publishedAt: {
                    required: true,
                },
            };

            if (value?.contentType === ReportContentType.Iframe) {
                return {
                    ...baseFields,
                    iframeUrl: {
                        required: !isEditing,
                        requiredValidation: requiredStringCondition,
                        validations: [safeUrlCondition],
                    },
                };
            }

            return {
                ...baseFields,
                file: {
                    required: !isEditing,
                },
            };
        },
    };
}

const defaultFormValue: PartialFormType = {
    contentType: ReportContentType.File,
    reportType: ReportTypeEnum.Report,
    visibility: ReportVisibility.Public,
};

function getFileFields(
    file: File | null | undefined,
    coverImage: File | null | undefined,
) {
    return {
        ...(isDefined(file) ? { file } : {}),
        ...(isDefined(coverImage) ? { coverImage } : {}),
    };
}

function DataAndReportsForm() {
    const { id } = useParams();
    const navigate = useRouting();
    const alert = useAlert();

    const isEditing = isDefined(id);

    const { user } = use(UserContext);

    const reportSchema = useMemo(() => getReportSchema(isEditing), [isEditing]);

    const {
        setFieldValue,
        error: formError,
        value,
        validate,
        setError,
        setValue,
    } = useForm(reportSchema, { value: defaultFormValue });

    const [{ data: detailData, fetching: detailFetching }] = useReportDetailQuery({
        variables: { id: isDefined(id) ? id : '' },
        pause: isNotDefined(id),
    });

    const [{ data: thematicAreasData }] = useThematicAreasQuery();

    const [{ fetching: creating }, createReport] = useCreateReportMutation();
    const [{ fetching: updating }, updateReport] = useUpdateReportMutation();

    const pending = creating || updating || detailFetching;

    const {
        reportVisibility: visibilityOptions,
        reportContentType: contentTypeOptions,
    } = useGlobalEnums();

    const thematicAreaOptions = thematicAreasData?.thematicAreas?.results;

    const isIframe = value.contentType === ReportContentType.Iframe;

    const getFileNameWithoutExtension = (
        file?: File | { name?: string } | null,
    ) => file?.name?.split('/').pop()?.replace(/\.[^/.]+$/, '');

    const fileName = getFileNameWithoutExtension(
        value.file instanceof File ? value.file : detailData?.report?.file,
    );

    const handleFileChange = useCallback(
        (file: File | undefined, name: 'file') => {
            setFieldValue(file, name);
        },
        [setFieldValue],
    );

    const handleCoverImageChange = useCallback(
        (file: File | undefined, name: 'coverImage') => {
            setFieldValue(file, name);
        },
        [setFieldValue],
    );

    const handleResult = useCallback((
        result: {
            ok?: boolean | null;
            errors?: Parameters<typeof transformToFormError>[0] | null;
        } | undefined | null,
        successMessage: string,
    ) => {
        if (isDefined(result) && result.ok) {
            navigate('dataAndReports');
            alert.show(successMessage, { variant: 'success' });
        } else if (isDefined(result) && isDefined(result.errors)) {
            setError(transformToFormError(result.errors));
            alert.show(errorMessage, { variant: 'danger' });
        } else {
            alert.show(errorMessage, { variant: 'danger' });
        }
    }, [navigate, alert, setError]);

    const handleCreate = useCallback(async (formValues: PartialFormType) => {
        const { file, coverImage, ...rest } = formValues;

        const res = await createReport({
            data: {
                ...removeNull(rest),
                ...getFileFields(file, coverImage),
            } as ReportCreateInput,
        });

        handleResult(res.data?.createReport, 'Report created successfully');
    }, [createReport, handleResult]);

    const handleUpdate = useCallback(async (formValues: PartialFormType) => {
        if (isNotDefined(id)) {
            return;
        }
        const { file, coverImage, ...rest } = formValues;

        const res = await updateReport({
            id,
            data: {
                ...omitKeys(removeNull(rest), ['contentType', 'iframeUrl']),
                description: rest.description ?? null,
                ...getFileFields(file, coverImage),
            } as ReportUpdateInput,
        });

        handleResult(res.data?.updateReport, 'Report updated successfully');
    }, [id, updateReport, handleResult]);

    const handleFormSubmit = useCallback(
        () => createSubmitHandler(
            validate,
            setError,
            isDefined(id) ? handleUpdate : handleCreate,
        )(),
        [validate, setError, id, handleUpdate, handleCreate],
    );

    const handleCancel = useCallback(() => {
        navigate('dataAndReports');
    }, [navigate]);

    const error = getErrorObject(formError);

    useEffect(() => {
        if (isEditing || isNotDefined(user?.fullName)) {
            return;
        }
        setFieldValue(user.fullName, 'owner');
    }, [isEditing, user?.fullName, setFieldValue]);

    useEffect(() => {
        if (isNotDefined(detailData?.report)) {
            return;
        }
        const {
            regionId,
            thematicAreaId,
            publishedAt,
            ...otherValues
        } = removeNull(detailData.report);

        delete (otherValues as { coverImage?: unknown }).coverImage;
        delete (otherValues as { file?: unknown }).file;
        setValue({
            ...otherValues,
            publishedAt: isDefined(publishedAt)
                ? encodeDate(new Date(publishedAt))
                : undefined,
            region: regionId ?? undefined,
            thematicArea: thematicAreaId,
        });
    }, [detailData, setValue]);

    if (detailFetching) {
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
            heading={isDefined(id) ? 'Edit Report' : 'Create Report'}
            headerDescription={isDefined(id)
                ? 'Manage and update the report'
                : 'Create a new report from organizational data'}
            withPadding
            footerActions={(
                <ListView>
                    <Button
                        name={undefined}
                        onClick={handleCancel}
                    >
                        Cancel
                    </Button>
                    <Button
                        name={undefined}
                        onClick={handleFormSubmit}
                        styleVariant="filled"
                        disabled={pending}
                    >
                        Save
                    </Button>
                </ListView>
            )}
        >
            <ListView layout="grid" withSidebar>
                <ListView layout="block">
                    <NonFieldError
                        error={formError}
                        withFallbackError
                    />
                    <InputSection
                        title="Title"
                        description="Enter the title of the report"
                        withAsteriskOnTitle
                    >
                        <TextInput
                            name="title"
                            value={value.title}
                            onChange={setFieldValue}
                            error={error?.title}
                            disabled={pending}
                        />
                    </InputSection>
                    <InputSection
                        title="Description"
                        description="Enter the description of the report"
                    >
                        <TextArea
                            name="description"
                            value={value.description}
                            onChange={setFieldValue}
                            error={error?.description}
                            disabled={pending}
                        />
                    </InputSection>
                    <InputSection
                        title="Disaster Type"
                        description="Enter the disaster type"
                    >
                        <TextInput
                            name="disasterType"
                            value={value.disasterType}
                            onChange={setFieldValue}
                            error={error?.disasterType}
                            disabled={pending}
                        />
                    </InputSection>
                    <InputSection
                        title="Cover Image"
                        description="Upload a cover image for the report (max 2MB)"
                    >
                        <CoverImageInput
                            name="coverImage"
                            value={value.coverImage instanceof File ? value.coverImage : undefined}
                            existingUrl={detailData?.report?.coverImage?.url}
                            onChange={handleCoverImageChange}
                            error={error?.coverImage}
                            disabled={pending}
                        />
                    </InputSection>
                    <InputSection
                        title="Content Type"
                        description="Choose whether the report is a file or an embedded link"
                        withAsteriskOnTitle
                    >
                        <RadioInput
                            name="contentType"
                            value={value.contentType}
                            onChange={setFieldValue}
                            options={contentTypeOptions}
                            keySelector={keySelector}
                            labelSelector={labelSelector}
                            error={error?.contentType}
                            disabled={pending || isDefined(id)}
                        />
                    </InputSection>
                    {isIframe ? (
                        <InputSection
                            title="Embed link"
                            description="Enter the Power BI report URL only (e.g., https://app.powerbi.com/...)"
                            withAsteriskOnTitle
                        >
                            <TextInput
                                name="iframeUrl"
                                value={value.iframeUrl}
                                onChange={setFieldValue}
                                error={error?.iframeUrl}
                                disabled={pending || isDefined(id)}
                            />
                        </InputSection>
                    ) : (
                        <InputSection
                            title="File"
                            description="Upload the report file (max 5MB)"
                            withAsteriskOnTitle
                        >
                            <FileInput
                                name="file"
                                fileName={fileName}
                                onChange={handleFileChange}
                                error={error?.file}
                                disabled={pending}
                            />
                        </InputSection>
                    )}
                    <InputSection
                        title="Owner"
                        description="Enter the owner of the report"
                    >
                        <TextInput
                            name="owner"
                            value={value.owner}
                            onChange={setFieldValue}
                            error={error?.owner}
                            disabled={pending}
                        />
                    </InputSection>
                    <InputSection
                        title="Region"
                        description="Select the region"
                    >
                        <RegionSelectInput
                            name="region"
                            level={AdminAreaLevel.Region}
                            value={value.region}
                            onChange={setFieldValue}
                            error={error?.region}
                            disabled={pending}
                        />
                    </InputSection>
                    <InputSection
                        title="Visibility"
                        description="Choose if the report is public or private"
                        withAsteriskOnTitle
                    >
                        <RadioInput
                            name="visibility"
                            value={value.visibility}
                            onChange={setFieldValue}
                            options={visibilityOptions}
                            keySelector={keySelector}
                            labelSelector={labelSelector}
                            error={error?.visibility}
                            disabled={pending}
                        />
                    </InputSection>
                    <InputSection
                        title="Category"
                        description="Select the thematic area"
                        withAsteriskOnTitle
                    >
                        <SelectInput
                            name="thematicArea"
                            value={value.thematicArea}
                            onChange={setFieldValue}
                            options={thematicAreaOptions}
                            keySelector={idSelector}
                            labelSelector={nameSelector}
                            error={error?.thematicArea}
                            disabled={pending}
                        />
                    </InputSection>
                    <InputSection
                        title="Published At"
                        description="Select the published date"
                        withAsteriskOnTitle
                    >
                        <DateInput
                            name="publishedAt"
                            value={value.publishedAt}
                            onChange={setFieldValue}
                            error={error?.publishedAt}
                            disabled={pending}
                        />
                    </InputSection>
                </ListView>
                {isIframe && (
                    <EmbedPreview url={value.iframeUrl} />
                )}
            </ListView>
        </Container>
    );
}

export default DataAndReportsForm;
