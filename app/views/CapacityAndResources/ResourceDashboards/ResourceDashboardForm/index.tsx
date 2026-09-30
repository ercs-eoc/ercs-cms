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
import NonFieldError from '#components/NonFieldError';
import RegionSelectInput from '#components/RegionSelectInput';
import {
    AdminAreaLevel,
    DashboardPage,
    type ExternalDashboardCreateInput,
    type ExternalDashboardUpdateInput,
    useCreateResourceDashboardMutation,
    useResourceDashboardDetailQuery,
    useUpdateResourceDashboardMutation,
} from '#generated/types/graphql';
import useAlert from '#hooks/useAlert';
import useRouting from '#hooks/useRouting';
import {
    errorMessage,
    labelSelector,
    safeUrlCondition,
    statusOptions,
    transformToFormError,
    valueSelector,
} from '#utils/common';

type PartialFormType = PartialForm<ExternalDashboardCreateInput>;
type FormSchema = ObjectSchema<PartialFormType>;
type FormSchemaFields = ReturnType<FormSchema['fields']>;

const dashboardSchema: FormSchema = {
    fields: (): FormSchemaFields => ({
        title: {
            required: true,
            requiredValidation: requiredStringCondition,
        },
        url: {
            required: true,
            requiredValidation: requiredStringCondition,
            validations: [safeUrlCondition],
        },
        page: {
            required: true,
        },
        capacityAndResource: {
            required: true,
        },
        description: {},
        region: {},
        order: {},
        isActive: {},
    }),
};

const defaultFormValue: PartialFormType = {
    page: DashboardPage.CapacityResources,
    isActive: false,
};

function ResourceDashboardForm() {
    const { id, dashboard } = useParams();
    const navigate = useRouting();
    const alert = useAlert();

    const {
        setFieldValue,
        error: formError,
        value,
        validate,
        setError,
        setValue,
    } = useForm(dashboardSchema, { value: { ...defaultFormValue, capacityAndResource: id } });

    const [{ data, fetching: detailFetching }] = useResourceDashboardDetailQuery({
        variables: { id: dashboard ?? '' },
        pause: !dashboard,
    });

    const [{ fetching: createPending }, createDashboard] = useCreateResourceDashboardMutation();
    const [{ fetching: updatePending }, updateDashboard] = useUpdateResourceDashboardMutation();

    const pending = createPending || updatePending || detailFetching;

    const handleCreate = useCallback(async (mutationData: PartialFormType) => {
        const createPayload = removeNull(mutationData) as ExternalDashboardCreateInput;
        const res = await createDashboard({
            data: createPayload,
        });
        const result = res.data?.createExternalDashboard;

        if (isDefined(result) && result.ok) {
            alert.show('Dashboard created successfully', { variant: 'success' });
            if (isDefined(id)) {
                navigate('resourceDashboards', { id });
            }
        } else if (isDefined(result) && isDefined(result.errors)) {
            setError(transformToFormError(result.errors));
            alert.show(errorMessage, { variant: 'danger' });
        } else {
            alert.show(errorMessage, { variant: 'danger' });
        }
    }, [createDashboard, id, navigate, alert, setError]);

    const handleUpdate = useCallback(async (mutationData: PartialFormType) => {
        if (isNotDefined(dashboard)) {
            return;
        }
        const updatePayload = {
            ...removeNull(mutationData),
            description: mutationData.description ?? null,
        } as ExternalDashboardUpdateInput;
        const res = await updateDashboard({
            id: dashboard,
            data: updatePayload,
        });
        const result = res.data?.updateExternalDashboard;

        if (isDefined(result) && result.ok) {
            alert.show('Dashboard updated successfully', { variant: 'success' });
            if (isDefined(id)) {
                navigate('resourceDashboards', { id });
            }
        } else if (isDefined(result) && isDefined(result.errors)) {
            setError(transformToFormError(result.errors));
            alert.show(errorMessage, { variant: 'danger' });
        } else {
            alert.show(errorMessage, { variant: 'danger' });
        }
    }, [updateDashboard, dashboard, id, navigate, alert, setError]);

    const showOnHome = data?.externalDashboard?.showOnHome ?? false;

    const handleFormSubmit = useCallback(
        () => createSubmitHandler(
            validate,
            setError,
            isDefined(dashboard) ? handleUpdate : handleCreate,
        )(),
        [validate, setError, dashboard, handleUpdate, handleCreate],
    );

    const requiresConfirmation = isDefined(dashboard) && showOnHome && value.isActive === false;

    const handleCancel = useCallback(() => {
        if (isDefined(id)) {
            navigate('resourceDashboards', { id });
        }
    }, [id, navigate]);

    const error = getErrorObject(formError);

    const dashboardData = data?.externalDashboard;

    useEffect(() => {
        if (!detailFetching && isDefined(dashboardData)) {
            const {
                regionId,
                ...otherValues
            } = removeNull(dashboardData);
            setValue({
                ...otherValues,
                region: regionId ?? undefined,
                capacityAndResource: id,
            });
        }
    }, [detailFetching, id, dashboardData, setValue]);

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
            heading={isDefined(dashboard) ? 'Edit Dashboard' : 'Create Dashboard'}
            headerDescription={isDefined(dashboard)
                ? 'Manage and update the dashboard'
                : 'Create a new dashboard for this capacity and resource'}
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
                    <NonFieldError
                        error={formError}
                        withFallbackError
                    />
                    <InputSection
                        title="Title"
                        description="Enter the title of the dashboard"
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
                        description="Enter the description of the dashboard"
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
                        title="Embed link"
                        description="Enter the embed link of the dashboard"
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
                    <InputSection
                        title="Status"
                        description="Choose if the dashboard is to be active or inactive"
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
                </ListView>
                <EmbedPreview url={value.url} />
            </ListView>
        </Container>
    );
}

export default ResourceDashboardForm;
