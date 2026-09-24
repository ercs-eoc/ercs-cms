import {
    useCallback,
    useEffect,
    useMemo,
} from 'react';
import { useParams } from 'react-router';
import {
    BlockLoading,
    Button,
    Container,
    InputSection,
    ListView,
    RadioInput,
    SelectInput,
    TextArea,
    TextInput,
} from '@ifrc-go/ui';
import {
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

import FileInput from '#components/FileInput';
import NonFieldError from '#components/NonFieldError';
import RegionSelectInput from '#components/RegionSelectInput';
import {
    AdminAreaLevel,
    type PmerReportCreateInput,
    PmerReportDocumentType,
    type PmerReportUpdateInput,
    ReportVisibility,
    useCreatePmerReportMutation,
    usePmerReportDetailQuery,
    useUpdatePmerReportMutation,
} from '#generated/types/graphql';
import useAlert from '#hooks/useAlert';
import useGlobalEnums from '#hooks/useGlobalEnums';
import useRouting from '#hooks/useRouting';
import {
    ACCEPTED_PMER_FILE_TYPES,
    errorMessage,
    keySelector,
    labelSelector,
    transformToFormError,
} from '#utils/common';

type PartialFormType = PartialForm<PmerReportCreateInput>;
type FormSchema = ObjectSchema<PartialFormType>;
type FormSchemaFields = ReturnType<FormSchema['fields']>;

function getPmerSchema(isEditing: boolean): FormSchema {
    return {
        fields: (): FormSchemaFields => ({
            title: {
                required: true,
                requiredValidation: requiredStringCondition,
            },
            description: {},
            category: {
                required: true,
            },
            reportType: {
                required: true,
            },
            file: {
                required: !isEditing,
            },
            visibility: {
                required: true,
            },
            department: {},
            region: {
                required: true,
            },
            project: {},
        }),
    };
}

const defaultFormValue: PartialFormType = {
    visibility: ReportVisibility.Public,
};

function PmerForm() {
    const { id } = useParams();
    const navigate = useRouting();
    const alert = useAlert();

    const isEditing = isDefined(id);

    const pmerSchema = useMemo(() => getPmerSchema(isEditing), [isEditing]);

    const {
        setFieldValue,
        error: formError,
        value,
        validate,
        setError,
        setValue,
    } = useForm(pmerSchema, { value: defaultFormValue });

    const [{ data: detailData, fetching: detailFetching }] = usePmerReportDetailQuery({
        variables: { id: isDefined(id) ? id : '' },
        pause: isNotDefined(id),
    });

    const [{ fetching: creating }, createPmerReport] = useCreatePmerReportMutation();
    const [{ fetching: updating }, updatePmerReport] = useUpdatePmerReportMutation();

    const pending = creating || updating || detailFetching;

    const {
        reportVisibility: visibilityOptions,
        pmerReportCategory: categoryOptions,
        pmerReportDocumentType: reportTypeOptions,
    } = useGlobalEnums();

    const fileName = value.file instanceof File
        ? value.file.name
        : detailData?.pmerReport?.file?.name?.split('/').pop();

    const handleReportTypeChange = useCallback(
        (reportType: PmerReportDocumentType | undefined, name: 'reportType') => {
            setFieldValue(reportType, name);
            setFieldValue(
                reportType === PmerReportDocumentType.AnnualPlan
                    || reportType === PmerReportDocumentType.AnnualReport
                    ? ReportVisibility.Private
                    : ReportVisibility.Public,
                'visibility',
            );
        },
        [setFieldValue],
    );

    const handleFileChange = useCallback(
        (file: File | undefined, name: 'file') => {
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
            navigate('pmer');
            alert.show(successMessage, { variant: 'success' });
        } else if (isDefined(result) && isDefined(result.errors)) {
            setError(transformToFormError(result.errors));
            alert.show(errorMessage, { variant: 'danger' });
        } else {
            alert.show(errorMessage, { variant: 'danger' });
        }
    }, [navigate, alert, setError]);

    const handleCreate = useCallback(async (formValues: PartialFormType) => {
        const { file, ...rest } = formValues;

        const res = await createPmerReport({
            data: {
                ...removeNull(rest),
                ...(isDefined(file) ? { file } : {}),
            } as PmerReportCreateInput,
        });

        handleResult(res.data?.createPmerReport, 'PMER created successfully');
    }, [createPmerReport, handleResult]);

    const handleUpdate = useCallback(async (formValues: PartialFormType) => {
        if (isNotDefined(id)) {
            return;
        }
        const { file, ...rest } = formValues;

        const res = await updatePmerReport({
            id,
            data: {
                ...removeNull(rest),
                description: rest.description ?? null,
                ...(isDefined(file) ? { file } : {}),
            } as PmerReportUpdateInput,
        });

        handleResult(res.data?.updatePmerReport, 'PMER updated successfully');
    }, [id, updatePmerReport, handleResult]);

    const handleFormSubmit = useCallback(
        () => createSubmitHandler(
            validate,
            setError,
            isEditing ? handleUpdate : handleCreate,
        )(),
        [validate, setError, isEditing, handleUpdate, handleCreate],
    );

    const handleCancel = useCallback(() => {
        navigate('pmer');
    }, [navigate]);

    const error = getErrorObject(formError);

    useEffect(() => {
        if (isNotDefined(detailData?.pmerReport)) {
            return;
        }
        const {
            region,
            ...otherValues
        } = removeNull(detailData.pmerReport);

        delete (otherValues as { file?: unknown }).file;
        setValue({
            ...otherValues,
            region: region?.id,
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
            heading={isEditing ? 'Edit PMER' : 'Create PMER'}
            headerDescription={isEditing
                ? 'Manage and update the PMER document'
                : 'Upload and organize a new PMER document'}
            withPadding
            withContentOverflow
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
            <ListView layout="block">
                <NonFieldError
                    error={formError}
                    withFallbackError
                />
                <InputSection
                    title="Title"
                    description="Enter the title of the PMER document"
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
                    description="Enter the description of the PMER document"
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
                    title="Report Category"
                    description="Select the category of the report"
                    withAsteriskOnTitle
                >
                    <SelectInput
                        name="category"
                        value={value.category}
                        onChange={setFieldValue}
                        options={categoryOptions}
                        keySelector={keySelector}
                        labelSelector={labelSelector}
                        error={error?.category}
                        disabled={pending}
                    />
                </InputSection>
                <InputSection
                    title="Report Type"
                    description="Select the type of the PMER document"
                    withAsteriskOnTitle
                >
                    <SelectInput
                        name="reportType"
                        value={value.reportType}
                        onChange={handleReportTypeChange}
                        options={reportTypeOptions}
                        keySelector={keySelector}
                        labelSelector={labelSelector}
                        error={error?.reportType}
                        disabled={pending}
                    />
                </InputSection>
                <InputSection
                    title="File Upload"
                    description="Upload the report file (max 5MB, accepted formats: .docx, .pdf, .xls, .xlsx, .csv, .png)"
                    withAsteriskOnTitle
                >
                    <FileInput
                        name="file"
                        fileName={fileName}
                        accept={ACCEPTED_PMER_FILE_TYPES}
                        onChange={handleFileChange}
                        error={error?.file}
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
                    title="Department / Sector"
                    description="Enter the department or sector"
                >
                    <TextInput
                        name="department"
                        value={value.department}
                        onChange={setFieldValue}
                        error={error?.department}
                        disabled={pending}
                    />
                </InputSection>
                <InputSection
                    title="Region"
                    description="Select the region"
                    withAsteriskOnTitle
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
                    title="Project"
                    description="Enter the project"
                >
                    <TextInput
                        name="project"
                        value={value.project}
                        onChange={setFieldValue}
                        error={error?.project}
                        disabled={pending}
                    />
                </InputSection>
            </ListView>
        </Container>
    );
}

export default PmerForm;
