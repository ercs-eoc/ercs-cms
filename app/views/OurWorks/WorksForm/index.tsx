import {
    useCallback,
    useEffect,
} from 'react';
import { useParams } from 'react-router';
import {
    BlockLoading,
    Button,
    ConfirmButton,
    Container,
    InputSection,
    ListView,
    NumberInput,
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

import EmbedPreview from '#components/EmbedPreview';
import RegionSelectInput from '#components/RegionSelectInput';
import {
    AdminAreaLevel,
    DashboardPage,
    type ExternalDashboardCreateInput,
    type ExternalDashboardUpdateInput,
    useCreateExternalDashboardMutation,
    useExternalDashboardDetailQuery,
    useUpdateExternalDashboardMutation,
} from '#generated/types/graphql';
import useAlert from '#hooks/useAlert';
import useRouting from '#hooks/useRouting';
import {
    errorMessage,
    keySelector,
    labelSelector,
    safeUrlCondition,
    statusOptions,
    transformToFormError,
    valueSelector,
} from '#utils/common';

type PartialFormType = PartialForm<ExternalDashboardCreateInput>;
type FormSchema = ObjectSchema<PartialFormType>;
type FormSchemaFields = ReturnType<FormSchema['fields']>;

const worksSchema: FormSchema = {
    fields: (): FormSchemaFields => ({
        page: {
            required: true,
        },
        title: {
            required: true,
            requiredValidation: requiredStringCondition,
        },
        description: {},
        region: {},
        url: {
            required: true,
            requiredValidation: requiredStringCondition,
            validations: [safeUrlCondition],
        },
        isActive: {},
        order: {},
    }),
};

const defaultEditFormValue: PartialFormType = {
    isActive: false,
};

const pageOptions = [
    { key: DashboardPage.ProjectMapping, label: 'Project Mapping' },
    { key: DashboardPage.EmergencyResponse, label: 'Emergency Responses' },
];

function WorksForm() {
    const { id } = useParams();
    const navigate = useRouting();
    const alert = useAlert();

    const {
        setFieldValue,
        error: formError,
        value,
        validate,
        setError,
        setValue,
    } = useForm(worksSchema, { value: defaultEditFormValue });

    const [{ data, fetching: worksDetailFetch }] = useExternalDashboardDetailQuery({
        variables: { id: isDefined(id) ? id : '' },
        pause: isNotDefined(id),
    });

    const [
        { fetching: createPending },
        createExternalDashboard,
    ] = useCreateExternalDashboardMutation();
    const [
        { fetching: updatePending },
        updateExternalDashboard,
    ] = useUpdateExternalDashboardMutation();

    const pending = createPending || updatePending || worksDetailFetch;

    const handleCreate = useCallback(async (mutationData: PartialFormType) => {
        const createPayload = removeNull(mutationData) as ExternalDashboardCreateInput;
        const res = await createExternalDashboard({ data: createPayload });
        const result = res.data?.createExternalDashboard;

        if (isDefined(result) && result.ok) {
            navigate('ourWorks');
            alert.show('Initiative created successfully', { variant: 'success' });
        } else if (isDefined(result) && isDefined(result.errors)) {
            setError(transformToFormError(result.errors));
            alert.show(errorMessage, { variant: 'danger' });
        } else {
            alert.show(errorMessage, { variant: 'danger' });
        }
    }, [createExternalDashboard, navigate, alert, setError]);

    const handleUpdate = useCallback(async (mutationData: PartialFormType) => {
        if (isNotDefined(id)) {
            return;
        }
        const updatePayload = {
            ...removeNull(mutationData),
            description: mutationData.description ?? null,
        } as ExternalDashboardUpdateInput;
        const res = await updateExternalDashboard({ id, data: updatePayload });
        const result = res.data?.updateExternalDashboard;

        if (isDefined(result) && result.ok) {
            navigate('ourWorks');
            alert.show('Initiative updated successfully', { variant: 'success' });
        } else if (isDefined(result) && isDefined(result.errors)) {
            setError(transformToFormError(result.errors));
            alert.show(errorMessage, { variant: 'danger' });
        } else {
            alert.show(errorMessage, { variant: 'danger' });
        }
    }, [updateExternalDashboard, id, navigate, alert, setError]);

    const showOnHome = data?.externalDashboard?.showOnHome ?? false;

    const handleFormSubmit = useCallback(
        () => createSubmitHandler(
            validate,
            setError,
            isDefined(id) ? handleUpdate : handleCreate,
        )(),
        [validate, setError, id, handleUpdate, handleCreate],
    );

    const requiresConfirmation = isDefined(id) && showOnHome && value.isActive === false;

    const handleCancel = useCallback(() => {
        navigate('ourWorks');
    }, [navigate]);

    const error = getErrorObject(formError);

    useEffect(() => {
        if (isNotDefined(data?.externalDashboard)) {
            return;
        }
        const { regionId, ...otherValues } = removeNull(data.externalDashboard);
        setValue({
            ...otherValues,
            region: regionId ?? undefined,
        });
    }, [data, setValue]);

    if (worksDetailFetch || createPending || updatePending) {
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
            heading={isDefined(id) ? 'Edit Initiative' : 'Create New Initiatives'}
            headerDescription={isDefined(id)
                ? 'Manage and update emergency response or project mapping on ongoing and initiative works'
                : 'Create a emergency response or project mapping on ongoing and initiative works'}
            withPadding
            footerActions={(
                <ListView>
                    <Button
                        name={undefined}
                        onClick={handleCancel}
                    >
                        Cancel
                    </Button>
                    {requiresConfirmation ? (
                        <ConfirmButton
                            name={undefined}
                            onConfirm={handleFormSubmit}
                            confirmHeading="Disable dashboard?"
                            confirmMessage="This dashboard is set to show on the homepage. Setting it as inactive will automatically remove it from the homepage quick links. Do you want to continue?"
                            styleVariant="filled"
                            disabled={pending}
                        >
                            Save
                        </ConfirmButton>
                    ) : (
                        <Button
                            name={undefined}
                            onClick={handleFormSubmit}
                            styleVariant="filled"
                            disabled={pending}
                        >
                            Save
                        </Button>
                    )}
                </ListView>
            )}
        >
            <ListView layout="grid" withSidebar>

                <ListView layout="block">
                    <InputSection
                        title="Operations"
                        description="Select the operation"
                        withAsteriskOnTitle
                    >
                        <SelectInput
                            name="page"
                            value={value.page}
                            onChange={setFieldValue}
                            options={pageOptions}
                            keySelector={keySelector}
                            labelSelector={labelSelector}
                            error={error?.page}
                            disabled={pending}
                        />
                    </InputSection>
                    <InputSection
                        title="Title"
                        description="Enter the title name of the dashboard"
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
                        description="Enter the description about the dashboard"
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
                        title="Embed link"
                        description="Enter the Power BI report URL only (e.g., https://app.powerbi.com/...)"
                        withAsteriskOnTitle
                    >
                        <TextInput
                            name="url"
                            value={value.url}
                            onChange={setFieldValue}
                            error={error?.url}
                            disabled={pending}
                        />
                    </InputSection>
                    <InputSection
                        title="Status"
                        description="Choose if the dashboard is to be active or inactive "
                    >
                        <RadioInput
                            name="isActive"
                            value={value.isActive}
                            onChange={setFieldValue}
                            options={statusOptions}
                            keySelector={valueSelector}
                            labelSelector={labelSelector}
                            error={error?.isActive}
                            disabled={pending}
                        />
                    </InputSection>
                    <InputSection
                        title="Order"
                        description="Enter the order in which the dashboard should appear"
                    >
                        <NumberInput
                            name="order"
                            value={value.order}
                            onChange={setFieldValue}
                            error={error?.order}
                            disabled={pending}
                        />
                    </InputSection>
                </ListView>

                <EmbedPreview url={value.url} />
            </ListView>
        </Container>
    );
}

export default WorksForm;
